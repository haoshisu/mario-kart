type Spring = { value: number; velocity: number };

/** Analytic critically damped spring: retain velocity across render frames. */
export function advanceSpring(spring: Spring, target: number, frequency: number, dt: number, reset: boolean) {
  if (reset) {
    spring.value = target;
    spring.velocity = 0;
    return;
  }
  const offset = spring.value - target;
  const impulse = spring.velocity + frequency * offset;
  const decay = Math.exp(-frequency * dt);
  spring.value = target + (offset + impulse * dt) * decay;
  spring.velocity = (spring.velocity - frequency * impulse * dt) * decay;
}

