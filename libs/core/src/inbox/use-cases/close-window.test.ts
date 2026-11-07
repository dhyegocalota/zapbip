import { describe, expect, test } from 'vitest';
import { createEnvironment } from '../testing/fixtures';
import { isOwnerWindowOpen } from '../window';
import { closeWindow } from './close-window';

describe('closeWindow', () => {
  test('CU-26 records when the channel closed the window and sends nothing', async () => {
    const environment = await createEnvironment();
    const windowBefore = await environment.repository.findWindow();
    const at = environment.clock.now() + 1;
    await closeWindow({ dependencies: environment.dependencies, at });
    const window = await environment.repository.findWindow();
    expect(window).toEqual({ ...windowBefore, closedAt: at });
    expect(isOwnerWindowOpen({ window, now: at })).toBe(false);
    expect(environment.sender.sessionRequests).toEqual([]);
    expect(environment.sender.templates).toEqual([]);
  });

  test('keeps the notice flag it found', async () => {
    const environment = await createEnvironment();
    await environment.repository.claimNotice();
    await closeWindow({ dependencies: environment.dependencies, at: environment.clock.now() });
    expect((await environment.repository.findWindow()).noticeSentForClosedWindow).toBe(true);
  });
});
