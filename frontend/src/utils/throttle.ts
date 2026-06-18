export function throttle<F extends (...args: unknown[]) => void>(fn: F, delay: number): F {
  let last = 0;
  return function (this: ThisParameterType<F>, ...args: Parameters<F>) {
    const now = Date.now();
    if (now - last >= delay) {
      last = now;
      fn.apply(this, args);
    }
  } as F;
}
