import type { CharacterId } from "../entities/characters";
import { courseHandling } from "../track/courseDesign";
import { sampleDrivingSurface } from "../track/drivingSurface";
import { createSurfaceResult } from "../track/trackSurface";
import { createStuntState, stepStuntLaunch, finishStunt, stuntProgress, applyStuntBoost, updateStuntTrick, STUNT_CONFIG } from "../core/stunts/stuntSystem";
import { ITEM_CONFIG } from "../core/items/itemConfig";
import { roadQuaternion } from "../track/trackSurface";
import { useTrack, useTrackRuntimeRef } from "../track/TrackContext";
import {
  RoundCuboidCollider,
  RigidBody,
  useAfterPhysicsStep,
  useBeforePhysicsStep,
  type CollisionEnterPayload,
  type RapierRigidBody,
} from "@react-three/rapier";
import { useCallback, useEffect, useRef, type RefObject } from "react";
import { Quaternion, Vector3 } from "three";
import { Kart } from "../components/Kart";
import { resolveWallCollision } from "../core/collision/collisionSystem";
import { KART_CONFIG, KART_START } from "../core/kart/kartConfig";
import { getDriftSteering } from "../core/kart/driftSystem";
import {
  applyLaunchBoost,
  createInitialKartState,
  getKartForward,
  getKartLateralSpeed,
  stepKartSimulation,
} from "../core/kart/kartPhysics";
import { EMPTY_KART_INPUT, type KartInput } from "../core/kart/kartTypes";
import type { InputAppliedMessage } from "../network/protocol";
import { createMarkerCrossingSegment } from "../core/race/checkpointSystem";
import {
  createInitialRaceState,
  getNextRaceMarker,
  restartRace,
  startRace,
  stepRace,
} from "../core/race/raceEngine";
import type { RaceStepResult } from "../core/race/raceTypes";
import type { KartRuntimeState, KartTelemetry } from "../runtime/kartRuntime";
import { createRaceTelemetry, type RaceCommands } from "../runtime/raceRuntime";
import { useKartGrounding } from "./useKartGrounding";

type KartBodyProps = {
  characterId: CharacterId;
  inputEnabled: boolean;
  inputRef: RefObject<KartInput>;
  inputReceiptRef: RefObject<InputAppliedMessage | null>;
  raceCommandsRef: RefObject<RaceCommands>;
  runtimeRef: RefObject<KartRuntimeState>;
  onReady: () => void;
  onInputApplied: (message: InputAppliedMessage) => void;
  onTelemetry: (telemetry: KartTelemetry) => void;
};

const UP_AXIS = new Vector3(0, 1, 0);

export function KartBody({
  characterId,
  inputEnabled,
  inputRef,
  inputReceiptRef,
  raceCommandsRef,
  runtimeRef,
  onReady,
  onInputApplied,
  onTelemetry,
}: KartBodyProps) {
  const track = useTrack(), trackRuntimeRef = useTrackRuntimeRef();
  const padCooldown = useRef(new Map<string, number>());
  const stunt = useRef(createStuntState(track.id === "taipei"));
  const roadSurface = useRef(createSurfaceResult());
  const groundKart = useKartGrounding();
  const bodyRef = useRef<RapierRigidBody>(null);
  const simulationRef = useRef(createInitialKartState(KART_START.yaw));
  const raceStateRef = useRef(createInitialRaceState());
  const effectiveInputRef = useRef<KartInput>(EMPTY_KART_INPUT);
  const rotationRef = useRef(new Quaternion());
  const velocityCommandRef = useRef({ x: 0, y: 0, z: 0 });
  const simulationTimeRef = useRef(0);
  const lastReactionTimeRef = useRef(Number.NEGATIVE_INFINITY);
  const collisionShakeRef = useRef(0);
  const impactRef = useRef<"none" | "light" | "heavy">("none");
  const impactUntilRef = useRef(0);
  const telemetryStepRef = useRef(0);
  const lastAcknowledgedInputRef = useRef(-1);

  const resetKart = useCallback((
    body: RapierRigidBody,
    position: readonly [number, number, number],
    yaw: number,
  ) => {
    stunt.current = createStuntState(track.id === "taipei");
    simulationRef.current = createInitialKartState(yaw);
    rotationRef.current.setFromAxisAngle(UP_AXIS, yaw);
    body.setTranslation({ x: position[0], y: position[1], z: position[2] }, true);
    body.setRotation(rotationRef.current, true);
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    collisionShakeRef.current = 0;
    impactRef.current = "none";
    impactUntilRef.current = 0;

    const runtime = runtimeRef.current;
    if (runtime) {
      runtime.position.x = position[0];
      runtime.position.y = position[1];
      runtime.position.z = position[2];
      runtime.yaw = yaw;
      runtime.poseRevision += 1;
      runtime.stuntProgress = 0;
      runtime.speed = 0;
      runtime.drifting = false;
      runtime.driftCharge = 0;
      runtime.driftTier = 0;
      runtime.turboRemaining = 0;
      runtime.turboTier = 0;
      runtime.collisionShake = 0;
    }
  }, [runtimeRef, track.id]);

  useEffect(() => {
    raceStateRef.current = startRace(raceStateRef.current).state;
    onReady();
  }, [onReady]);

  const courseSurface = useRef(createSurfaceResult());
  useBeforePhysicsStep(() => {
    const body = bodyRef.current;
    const input = inputRef.current;
    const commands = raceCommandsRef.current;
    const runtime = runtimeRef.current;

    if (!body || !input || !commands || !runtime) {
      return;
    }

    if (commands.restartRequested) {
      commands.restartRequested = false;
      padCooldown.current.clear();
      commands.syntheticCrossingsRequested = 0;
      commands.forcedRespawnRequested = false;
      raceStateRef.current = restartRace().state;
      simulationTimeRef.current = 0;
      lastReactionTimeRef.current = Number.NEGATIVE_INFINITY;
      resetKart(body, KART_START.position, KART_START.yaw);
    }

    const raceState = raceStateRef.current;
    const canDrive =
      inputEnabled &&
      raceState.phase === "RACING" &&
      raceState.respawn.protectionRemaining <= 0;
    const effectiveInput = canDrive ? input : EMPTY_KART_INPUT;
    effectiveInputRef.current = effectiveInput;

    if (!canDrive) {
      simulationRef.current = createInitialKartState(simulationRef.current.yaw);
    }

    if (canDrive) {
      const position = body.translation();
      for (const pad of track.items.BOOST_PADS) {
        if ((padCooldown.current.get(pad.id) ?? 0) > simulationTimeRef.current ||
          Math.abs(position.y - KART_START.position[1] - pad.height) > 1.2 ||
          Math.hypot(position.x - pad.position[0], position.z - pad.position[1]) >= ITEM_CONFIG.padRadius) continue;
        const drift = simulationRef.current.drift;
        simulationRef.current = { ...simulationRef.current, drift: { ...drift,
          turboTier: drift.turboTier === 3 ? 3 : 2,
          turboRemaining: Math.max(drift.turboRemaining, ITEM_CONFIG.padBoostSeconds) } };
        padCooldown.current.set(pad.id, simulationTimeRef.current + ITEM_CONFIG.padCooldown);
      }
    }
    const coursePosition = body.translation();
    const road = sampleDrivingSurface(coursePosition.x, coursePosition.z, track, courseSurface.current, coursePosition.y - KART_START.position[1], trackRuntimeRef.current.bridge?.locked);
    const handling = courseHandling(track.id, road, canDrive && !stunt.current.active && Math.abs(coursePosition.y - road.height - KART_START.position[1]) < .8, simulationRef.current.yaw, trackRuntimeRef.current.seconds, track.roughZones);
    updateStuntTrick(stunt.current, effectiveInput.drift, canDrive, KART_CONFIG.fixedTimeStep);
    if (stunt.current.active) simulationRef.current = { ...simulationRef.current, drift: { ...simulationRef.current.drift, active:false, direction:0, charge:0, chargeTier:0 } };
    const step = stepKartSimulation(
      simulationRef.current,
      stunt.current.active ? { ...effectiveInput, drift: false, steer: effectiveInput.steer * STUNT_CONFIG.airSteering } : effectiveInput,
      KART_CONFIG.fixedTimeStep,
      undefined, handling,
    );
    simulationRef.current = step.state;
    simulationTimeRef.current += KART_CONFIG.fixedTimeStep;
    collisionShakeRef.current = Math.max(
      0,
      collisionShakeRef.current - KART_CONFIG.fixedTimeStep * 2.8,
    );

    const currentVelocity = body.linvel();
    const forward = getKartForward(step.state.yaw);
    const rightX = -forward.z;
    const rightZ = forward.x;
    const lateralSpeed = currentVelocity.x * rightX + currentVelocity.z * rightZ;
    const rebounding = simulationTimeRef.current - lastReactionTimeRef.current < KART_CONFIG.collision.reboundSeconds;
    const retainedLateralSpeed = rebounding ? lateralSpeed * Math.exp(-3 * KART_CONFIG.fixedTimeStep) : getKartLateralSpeed(
      lateralSpeed,
      step.state.speed,
      getDriftSteering(step.state.drift, effectiveInput.steer),
      step.state.drift.active,
      KART_CONFIG.fixedTimeStep,
      handling,
    );

    rotationRef.current.setFromAxisAngle(UP_AXIS, step.state.yaw);
    const position = body.translation();
    const launched = stepStuntLaunch(stunt.current, position.x, position.y, position.z,
      step.state.yaw, step.state.speed, track.ramps, canDrive, KART_CONFIG.fixedTimeStep);
    const surface = stunt.current.active ? null : groundKart(body);
    body.setRotation(surface ? roadQuaternion(step.state.yaw, surface) : rotationRef.current, true);

    const command = velocityCommandRef.current;
    command.x = forward.x * step.state.speed + rightX * retainedLateralSpeed;
    command.y = launched ? stunt.current.launchSpeed : currentVelocity.y;
    command.z = forward.z * step.state.speed + rightZ * retainedLateralSpeed;
    if (surface) command.y = command.x * surface.gradientX + command.z * surface.gradientZ;
    body.setLinvel(command, true);

    runtime.stuntProgress = stuntProgress(stunt.current);
    runtime.yaw = step.state.yaw;
    runtime.speed = step.state.speed;
    runtime.steer = effectiveInput.steer;
    runtime.drifting = step.state.drift.active;
    runtime.trackSeconds = trackRuntimeRef.current.seconds;
    runtime.driftCharge = step.state.drift.charge;
    runtime.driftTier = step.state.drift.chargeTier;
    runtime.turboRemaining = step.state.drift.turboRemaining;
    runtime.turboTier = step.state.drift.turboTier;
    runtime.collisionShake = collisionShakeRef.current;
    runtime.finished = raceStateRef.current.phase === "FINISHED";

    const inputReceipt = inputReceiptRef.current;
    if (
      inputEnabled &&
      inputReceipt &&
      inputReceipt.sequence !== lastAcknowledgedInputRef.current
    ) {
      lastAcknowledgedInputRef.current = inputReceipt.sequence;
      onInputApplied(inputReceipt);
    }
  });

  useAfterPhysicsStep(() => {
    const body = bodyRef.current;
    const commands = raceCommandsRef.current;
    const runtime = runtimeRef.current;

    if (!body || !commands || !runtime) {
      return;
    }

    const point = body.translation();
    if (stepStuntLaunch(stunt.current, point.x, point.y, point.z, simulationRef.current.yaw,
      simulationRef.current.speed, track.ramps, inputEnabled && raceStateRef.current.phase === "RACING", 0)) {
      const velocity = body.linvel();
      body.setLinvel({ x: velocity.x, y: stunt.current.launchSpeed, z: velocity.z }, true);
    }
    const road = sampleDrivingSurface(point.x, point.z, track, roadSurface.current, point.y - KART_START.position[1]);
    if (finishStunt(stunt.current, point.y - road.height - KART_START.position[1], body.linvel().y, road.distance)) {
      if (stunt.current.trickSucceeded) simulationRef.current = applyStuntBoost(simulationRef.current);
    }
    if (!stunt.current.active) groundKart(body);
    runtime.stuntProgress = stuntProgress(stunt.current);
    const translation = body.translation();
    runtime.position.x = translation.x;
    runtime.position.y = translation.y;
    runtime.position.z = translation.z;

    const velocity = body.linvel();
    const bodyRotation = body.rotation();
    const raceInput = {
      position: [translation.x, translation.y, translation.z] as const,
      signedSpeed: Math.hypot(velocity.x, velocity.z),
      throttle: effectiveInputRef.current.throttle,
      upY: 1 - 2 * (bodyRotation.x ** 2 + bodyRotation.z ** 2),
    };

    let raceResult: RaceStepResult;
    if (commands.forcedRespawnRequested && raceStateRef.current.phase === "RACING") {
      commands.forcedRespawnRequested = false;
      raceResult = stepRace(
        raceStateRef.current,
        {
          ...raceInput,
          position: [translation.x, -2, translation.z],
        },
        KART_CONFIG.fixedTimeStep,
        track.race,
      );
    } else if (
      commands.syntheticCrossingsRequested > 0 &&
      raceStateRef.current.phase === "RACING"
    ) {
      commands.syntheticCrossingsRequested -= 1;
      const marker = getNextRaceMarker(raceStateRef.current, track.race);
      const segment = createMarkerCrossingSegment(marker, "forward");
      raceResult = stepRace(
        { ...raceStateRef.current, previousPosition: segment.previous },
        {
          ...raceInput,
          // E2E crossings must use the marker's road level on elevated courses.
          position: [segment.current[0], marker.respawn.position[1], segment.current[1]],
        },
        KART_CONFIG.fixedTimeStep,
        track.race,
      );
      raceResult = {
        ...raceResult,
        state: {
          ...raceResult.state,
          previousPosition: [translation.x, translation.z],
        },
      };
    } else {
      raceResult = stepRace(
        raceStateRef.current,
        raceInput,
        KART_CONFIG.fixedTimeStep,
        track.race,
      );
    }
    if (raceStateRef.current.phase === "COUNTDOWN" && raceResult.state.phase === "RACING") {
      simulationRef.current = applyLaunchBoost(simulationRef.current);
    }
    raceStateRef.current = raceResult.state;

    if (raceResult.respawn) {
      resetKart(
        body,
        raceResult.respawn.pose.position,
        raceResult.respawn.pose.yaw,
      );
    }

    telemetryStepRef.current += 1;
    const urgentEvent = raceResult.events.some(
      (event) => event.type === "RACE_FINISHED" || event.type === "RESPAWN",
    );
    if (telemetryStepRef.current < KART_CONFIG.telemetryIntervalSteps && !urgentEvent) {
      return;
    }
    telemetryStepRef.current = 0;

    if (simulationTimeRef.current >= impactUntilRef.current) {
      impactRef.current = "none";
    }

    onTelemetry({
      signedSpeed: simulationRef.current.speed,
      speedKph: Math.abs(simulationRef.current.speed) * 3.6,
      position: [runtime.position.x, runtime.position.z],
      height: runtime.position.y,
      stuntProgress: runtime.stuntProgress,
      yaw: simulationRef.current.yaw,
      drifting: simulationRef.current.drift.active,
      driftReady: simulationRef.current.drift.chargeTier > 0,
      driftTier: simulationRef.current.drift.chargeTier,
      turboActive: simulationRef.current.drift.turboRemaining > 0,
      turboTier: simulationRef.current.drift.turboTier,
      impact: impactRef.current,
      race: createRaceTelemetry(raceStateRef.current, track.race.CHECKPOINTS.length),
    });
  });

  const handleCollision = useCallback((event: CollisionEnterPayload) => {
    if (
      event.other.colliderObject?.name !== "track-guard" ||
      raceStateRef.current.phase !== "RACING" ||
      raceStateRef.current.respawn.protectionRemaining > 0
    ) {
      return;
    }

    const body = bodyRef.current;
    if (!body) {
      return;
    }

    const currentVelocity = body.linvel();
    const normal = event.manifold.normal();
    const result = resolveWallCollision({
      velocity: { x: velocityCommandRef.current.x, z: velocityCommandRef.current.z },
      normal: { x: normal.x, z: normal.z },
      time: simulationTimeRef.current,
      lastReactionTime: lastReactionTimeRef.current,
    });

    if (!result.reacted) {
      return;
    }

    lastReactionTimeRef.current = result.reactionTime;
    collisionShakeRef.current = result.shake;
    impactRef.current = result.heavy ? "heavy" : "light";
    impactUntilRef.current = simulationTimeRef.current + (result.heavy ? 0.55 : 0.3);
    body.setLinvel(
      { x: result.velocity.x, y: currentVelocity.y, z: result.velocity.z },
      true,
    );

    const forward = getKartForward(simulationRef.current.yaw);
    simulationRef.current = {
      ...simulationRef.current,
      speed: result.velocity.x * forward.x + result.velocity.z * forward.z,
    };
  }, []);

  return (
    <RigidBody
      ref={bodyRef}
      angularDamping={8}
      canSleep={false}
      softCcdPrediction={KART_CONFIG.softCcdPrediction}
      colliders={false}
      linearDamping={0.05}
      lockRotations
      name="player-kart"
      onCollisionEnter={handleCollision}
      position={KART_START.position}
      rotation={[0, KART_START.yaw, 0]}
      type="dynamic"
    >
      <RoundCuboidCollider
        args={[0.62 * KART_CONFIG.modelScale, 0.19, 0.90 * KART_CONFIG.modelScale, 0.06]}
        friction={0}
        position={[0, -0.18 + KART_CONFIG.grounding.colliderLift, 0]}
        name="kart-body"
        restitution={0}
      />
      <Kart characterId={characterId} runtimeRef={runtimeRef} />
    </RigidBody>
  );
}
