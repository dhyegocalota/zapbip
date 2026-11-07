import { WorkerSecret } from '../../operations/worker-secret';
import { createAesGcmSecretBox, type SecretBox } from '../platform/aes-gcm-secret-box';
import type { NumberRegistry, OutboundNumber, RegisteredNumber } from '../../numbers/number-registry';
import type { Bindings } from '../../contract/env';

export class D1NumberRegistry implements NumberRegistry {
  constructor(_input: { database: D1Database; secretBox: SecretBox }) {}

  findByPhoneNumberIds(_input: { phoneNumberIds: string[] }): Promise<RegisteredNumber[]> {
    throw new Error('D1NumberRegistry.findByPhoneNumberIds is not implemented');
  }

  findByWabaIds(_input: { wabaIds: string[] }): Promise<RegisteredNumber[]> {
    throw new Error('D1NumberRegistry.findByWabaIds is not implemented');
  }

  openAppSecret(_input: { metaAppRef: string }): Promise<string> {
    throw new Error('D1NumberRegistry.openAppSecret is not implemented');
  }

  openForAccount(_input: { accountId: string }): Promise<OutboundNumber> {
    throw new Error('D1NumberRegistry.openForAccount is not implemented');
  }

  openForInbound(_input: { numberId: string }): Promise<OutboundNumber> {
    throw new Error('D1NumberRegistry.openForInbound is not implemented');
  }

  openTheOnlyNumber(): Promise<OutboundNumber> {
    throw new Error('D1NumberRegistry.openTheOnlyNumber is not implemented');
  }
}

export function numberRegistryOf(input: { bindings: Pick<Bindings, 'CONNECTIONS' | 'NUMBER_REGISTRY_KEY'> }): NumberRegistry {
  return new D1NumberRegistry({
    database: input.bindings.CONNECTIONS,
    secretBox: createAesGcmSecretBox({ base64Key: input.bindings.NUMBER_REGISTRY_KEY, keyName: WorkerSecret.NumberRegistryKey }),
  });
}
