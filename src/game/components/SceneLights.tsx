export function SceneLights() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <hemisphereLight color="#dcecff" groundColor="#26351e" intensity={1.35} />
      <directionalLight
        castShadow
        color="#fff1d2"
        intensity={2.4}
        position={[18, 30, 12]}
        shadow-bias={-0.00015}
        shadow-camera-bottom={-38}
        shadow-camera-far={80}
        shadow-camera-left={-38}
        shadow-camera-right={38}
        shadow-camera-top={38}
        shadow-mapSize-height={2048}
        shadow-mapSize-width={2048}
      />
    </>
  );
}
