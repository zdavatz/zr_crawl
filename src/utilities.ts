export async function retry<T>(
  count: number,
  fn: () => Promise<T>,
): Promise<T> {
  if (count <= 0) {
    return fn();
  }
  try {
    return await fn();
  } catch (e) {
    return await retry(count - 1, fn);
  }
}
