import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeGraph, startFakeGraph } from '../support/fake-graph';

const EPHEMERAL_PORT = 0;
const OWNER_RESOURCE = '1000000000777';
const NEIGHBOUR_RESOURCE = '1000000000888';
const SERVER_ERROR_STATUS = 500;
const OK_STATUS = 200;
const NOT_FOUND_STATUS = 404;

let stopGraph: () => Promise<void>;
let baseUrl: string;

function pathOf(input: { resource: string }): string {
  return `/v24.0/${input.resource}`;
}

function scopedTo(input: { resource: string }): FakeGraph {
  return new FakeGraph({ baseUrl, resourceIds: [input.resource] });
}

beforeAll(async () => {
  const started = await startFakeGraph({ port: EPHEMERAL_PORT });
  stopGraph = started.stop;
  baseUrl = `http://127.0.0.1:${started.port}`;
});

afterAll(async () => {
  await stopGraph();
});

describe('fake Graph isolation between the tests that share it', () => {
  it('keeps the script of one resource when a neighbour resets its own', async () => {
    const owner = scopedTo({ resource: OWNER_RESOURCE });
    const neighbour = scopedTo({ resource: NEIGHBOUR_RESOURCE });
    await owner.respondWith({ method: 'GET', path: pathOf({ resource: OWNER_RESOURCE }), status: SERVER_ERROR_STATUS, body: {} });
    await neighbour.reset();
    const response = await fetch(`${baseUrl}${pathOf({ resource: OWNER_RESOURCE })}`);
    expect(response.status).toBe(SERVER_ERROR_STATUS);
  });

  it('keeps the requests of one resource when a neighbour resets its own', async () => {
    const owner = scopedTo({ resource: OWNER_RESOURCE });
    const neighbour = scopedTo({ resource: NEIGHBOUR_RESOURCE });
    await owner.reset();
    await fetch(`${baseUrl}${pathOf({ resource: OWNER_RESOURCE })}`);
    await neighbour.reset();
    expect((await owner.requests()).map((request) => request.path)).toEqual([pathOf({ resource: OWNER_RESOURCE })]);
  });

  it('lists only the requests of the resources it owns', async () => {
    const owner = scopedTo({ resource: OWNER_RESOURCE });
    await owner.reset();
    await fetch(`${baseUrl}${pathOf({ resource: OWNER_RESOURCE })}`);
    await fetch(`${baseUrl}${pathOf({ resource: NEIGHBOUR_RESOURCE })}`);
    expect((await owner.requests()).map((request) => request.path)).toEqual([pathOf({ resource: OWNER_RESOURCE })]);
  });

  it('clears its own script on reset', async () => {
    const owner = scopedTo({ resource: OWNER_RESOURCE });
    await owner.respondWith({ method: 'GET', path: pathOf({ resource: OWNER_RESOURCE }), status: OK_STATUS, body: {} });
    await owner.reset();
    const response = await fetch(`${baseUrl}${pathOf({ resource: OWNER_RESOURCE })}`);
    expect(response.status).toBe(NOT_FOUND_STATUS);
  });

  it('still clears everything on an unscoped reset', async () => {
    const everything = new FakeGraph({ baseUrl });
    await everything.respondWith({ method: 'GET', path: pathOf({ resource: NEIGHBOUR_RESOURCE }), status: OK_STATUS, body: {} });
    await everything.reset();
    expect(await everything.requests()).toEqual([]);
    expect((await fetch(`${baseUrl}${pathOf({ resource: NEIGHBOUR_RESOURCE })}`)).status).toBe(NOT_FOUND_STATUS);
  });
});
