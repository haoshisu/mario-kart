import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { BackSide, Color, type Mesh } from "three";
import { useTrack } from "../track/TrackContext";

/** A distant horizon separates roofs and ridgelines from the upper atmosphere. */
export function TaiwanSky() {
  const track = useTrack(), ref = useRef<Mesh>(null);
  const uniforms = useMemo(() => ({
    zenith: { value: new Color(track.sky) },
    horizon: { value: new Color(track.id === "taipei" ? "#947c7b" : track.id === "kaohsiung" ? "#ffe0b2" : track.id === "jiufen" ? "#b2b6a9" : "#e8dabe") },
  }), [track]);
  useFrame(({ camera }) => { ref.current?.position.copy(camera.position); });
  return <mesh ref={ref} renderOrder={-1000} frustumCulled={false}>
    <sphereGeometry args={[200, 16, 12]} />
    <shaderMaterial side={BackSide} depthWrite={false} toneMapped={false} uniforms={uniforms}
      vertexShader="varying vec3 direction; void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}"
      fragmentShader={`uniform vec3 zenith; uniform vec3 horizon; varying vec3 direction;
        void main(){float h=normalize(direction).y;gl_FragColor=vec4(mix(horizon,zenith,smoothstep(-.05,.65,h)),1.0);
        #include <colorspace_fragment>
        }`} />
  </mesh>;
}
