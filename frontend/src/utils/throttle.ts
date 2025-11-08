export function throttle<F extends (...args: any[]) => void>(fn: F, delay: number): F {
  let last = 0;
  return function(this: any, ...args: any[]) {
    const now = Date.now();
    if (now - last >= delay) {
      last = now;
      fn.apply(this, args);
    }
  } as F;
}
