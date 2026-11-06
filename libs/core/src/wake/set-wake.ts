import { SetWakeStatus, WakeMode, WakeStatus } from '@zapbip/types';
import { assertWakeTarget, invalidWakeField, WakeTargetField } from './assert-wake-target';
import { WAKE_SEALED_KEY_VERSION } from './constants';
import type { SetWakeInput, SetWakeResult } from './wake-ports';
import { wakeAssociatedData } from './wake-associated-data';
import { wakeRungFor } from './wake-rung';
import type { StoredWake } from './wake-setting';

async function lastDeliveredAtOf(input: { setWake: SetWakeInput }): Promise<number | null> {
  const previous = await input.setWake.wake.repository.findWake({ agent: input.setWake.connection.agent });
  return previous === null ? null : previous.lastDeliveredAt;
}

async function saveWebhook(input: SetWakeInput): Promise<SetWakeResult> {
  const { wake, connection, setting, publicHost } = input;
  const { url, token } = setting;
  if (url === null) throw invalidWakeField({ field: WakeTargetField.Url });
  if (token === null) throw invalidWakeField({ field: WakeTargetField.Token });
  const target = assertWakeTarget({ url, token, publicHost });
  const sealedTarget = await wake.secretBox.seal({
    plain: JSON.stringify({ url, token }),
    associatedData: wakeAssociatedData(connection),
  });
  const storedWake: StoredWake = {
    agent: connection.agent,
    mode: WakeMode.Webhook,
    target: { provider: target.provider, host: new URL(url).hostname, sealedTarget, keyVersion: WAKE_SEALED_KEY_VERSION },
    status: WakeStatus.Active,
    lastDeliveredAt: await lastDeliveredAtOf({ setWake: input }),
  };
  await wake.repository.saveWake({ wake: storedWake });
  return {
    status: SetWakeStatus.Saved,
    wakeMode: WakeMode.Webhook,
    effectiveRung: wakeRungFor({ mode: WakeMode.Webhook }),
    provider: target.provider,
  };
}

async function clearWebhook(input: SetWakeInput): Promise<SetWakeResult> {
  const { wake, connection } = input;
  const storedWake: StoredWake = {
    agent: connection.agent,
    mode: WakeMode.None,
    target: null,
    status: WakeStatus.Active,
    lastDeliveredAt: await lastDeliveredAtOf({ setWake: input }),
  };
  await wake.repository.saveWake({ wake: storedWake });
  await wake.repository.deleteJob({ agent: connection.agent });
  return { status: SetWakeStatus.Saved, wakeMode: WakeMode.None, effectiveRung: wakeRungFor({ mode: WakeMode.None }), provider: null };
}

const WAKE_SETTERS: Record<WakeMode, (input: SetWakeInput) => Promise<SetWakeResult>> = {
  [WakeMode.None]: clearWebhook,
  [WakeMode.Webhook]: saveWebhook,
};

export function setWake(input: SetWakeInput): Promise<SetWakeResult> {
  return WAKE_SETTERS[input.setting.mode](input);
}
