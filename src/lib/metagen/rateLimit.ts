export function createSimpleRateLimiter({ minIntervalMs }: { minIntervalMs: number }) {
  let lastAt = 0;
  return {
    canRun() {
      const now = Date.now();
      return now - lastAt >= minIntervalMs;
    },
    markRun() {
      lastAt = Date.now();
    },
    msUntilNext() {
      const now = Date.now();
      return Math.max(0, minIntervalMs - (now - lastAt));
    },
  };
}
