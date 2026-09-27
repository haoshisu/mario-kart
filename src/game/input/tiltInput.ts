import { clampSignedUnit } from "../network/protocol";

export type DeviceTiltSample = Readonly<{
  beta: number | null;
  gamma: number | null;
  screenAngle: number;
}>;

function normalizedScreenAngle(angle: number) {
  return ((Math.round(angle / 90) * 90) % 360 + 360) % 360;
}

export function getTiltAxis(sample: DeviceTiltSample) {
  const beta = sample.beta ?? 0;
  const gamma = sample.gamma ?? 0;

  switch (normalizedScreenAngle(sample.screenAngle)) {
    case 90:
      return beta;
    case 180:
      return -gamma;
    case 270:
      return -beta;
    default:
      return gamma;
  }
}

export class TiltInputController {
  private baseline: number | null = null;
  private orientation = 0;

  constructor(private sensitivityDegrees = 28) {}

  update(sample: DeviceTiltSample) {
    const orientation = normalizedScreenAngle(sample.screenAngle);
    const axis = getTiltAxis(sample);
    if (this.baseline === null || orientation !== this.orientation) {
      this.baseline = axis;
      this.orientation = orientation;
      return 0;
    }
    return clampSignedUnit((axis - this.baseline) / this.sensitivityDegrees);
  }

  calibrate(sample?: DeviceTiltSample) {
    this.baseline = sample ? getTiltAxis(sample) : null;
    this.orientation = sample ? normalizedScreenAngle(sample.screenAngle) : 0;
  }

  setSensitivity(degrees: number) {
    this.sensitivityDegrees = Math.min(60, Math.max(10, degrees));
  }
}

