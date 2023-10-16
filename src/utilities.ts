// @deno-types="npm:@types/highland"
import Highland from "npm:highland@2.13.5";

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

export async function* toGenerator<T>(
  stream: Highland.Stream<T>,
): AsyncGenerator<T, void, void> {
  let ended = false;
  while (!ended) {
    const value: T | Highland.Nil = await new Promise((res, rej) => {
      stream.pull((err, x) => {
        if (err) {
          rej(err);
        } else {
          res(x);
        }
      });
    });

    if (Highland.isNil(value)) {
      return;
    } else {
      yield value;
    }
  }
}
