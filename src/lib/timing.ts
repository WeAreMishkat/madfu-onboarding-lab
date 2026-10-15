/**
 * Simulated latency. Every "backend" wait in the Lab goes through here so tests can run instantly
 * (setDemoSpeed(0)) while the deployed demo keeps realistic pacing.
 */
let speed = 1;

export function setDemoSpeed(factor: number) {
  speed = factor;
}

export function demoMs(ms: number): number {
  return Math.round(ms * speed);
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, demoMs(ms)));
}
