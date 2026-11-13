import { DAY_MS, DeliveryState, OwnerLocale } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { APP_ORIGIN, createAccountFixture, sessionTexts } from '../testing/fixtures';
import { noticeAccessOpened } from './notice-access-opened';

describe('noticeAccessOpened', () => {
  test('sends the message in the owner language inside the window', async () => {
    const fixture = await createAccountFixture({ locale: OwnerLocale.EnglishUs });
    const delivery = await noticeAccessOpened({
      dependencies: fixture.environment.dependencies,
      account: fixture.account,
      appOrigin: APP_ORIGIN,
    });
    expect(delivery).toBe(DeliveryState.Sent);
    expect(sessionTexts(fixture)).toEqual([
      `Your zapbip access is open. Send "new agent <name>" to create your first agent or open ${APP_ORIGIN}.`,
    ]);
  });

  test('points a Portuguese owner to the pt-br app', async () => {
    const fixture = await createAccountFixture({ locale: OwnerLocale.PortugueseBrazil });
    await noticeAccessOpened({ dependencies: fixture.environment.dependencies, account: fixture.account, appOrigin: APP_ORIGIN });
    expect(sessionTexts(fixture)[0]).toContain(`${APP_ORIGIN}/pt-br`);
  });

  test('queues the message behind the notice template once the window is closed', async () => {
    const fixture = await createAccountFixture({ locale: OwnerLocale.EnglishUs });
    await fixture.environment.clock.advance({ ms: DAY_MS + 1 });
    const delivery = await noticeAccessOpened({
      dependencies: fixture.environment.dependencies,
      account: fixture.account,
      appOrigin: APP_ORIGIN,
    });
    expect(delivery).toBe(DeliveryState.Queued);
    expect(sessionTexts(fixture)).toEqual([]);
    expect(fixture.environment.sender.templates).toHaveLength(1);
  });
});
