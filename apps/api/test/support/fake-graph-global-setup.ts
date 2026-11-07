import { startFakeGraph } from './fake-graph';

const FAKE_GRAPH_PORT = 4012;

export default async function setup(): Promise<() => Promise<void>> {
  const fakeGraph = await startFakeGraph({ port: FAKE_GRAPH_PORT });
  return fakeGraph.stop;
}
