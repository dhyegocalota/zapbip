export type Serializer = <Result>(input: { key: object; task: () => Promise<Result> }) => Promise<Result>;

export function createSerializer(): Serializer {
  const tails = new WeakMap<object, Promise<unknown>>();
  return ({ key, task }) => {
    const previous = tails.get(key);
    const running = previous === undefined ? task() : previous.then(task);
    tails.set(
      key,
      running.catch(() => undefined),
    );
    return running;
  };
}
