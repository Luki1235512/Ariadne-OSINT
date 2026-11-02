export function moveActive(current: number, step: 1 | -1, count: number): number {
  if (count === 0) {
    return -1;
  }
  if (current === -1) {
    return step === 1 ? 0 : count - 1;
  }
  return (current + step + count) % count;
}
