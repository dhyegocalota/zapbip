import type {
  WakeLogEvent,
  WakeObserver,
  WakeRepository,
  WakeSecretBox,
  WakeTransport,
  RecordedWakeRequest,
  ScriptedWakeResponse,
} from '../wake-ports';
import type { AgentName } from '../../inbox/connection';

export type ScriptedWakeTransport = WakeTransport & {
  enqueue(input: { agent: AgentName; responses: ScriptedWakeResponse[] }): void;
  readonly requests: RecordedWakeRequest[];
  requestsFor(input: { agent: AgentName }): RecordedWakeRequest[];
};

export type RecordingWakeObserver = WakeObserver & { readonly events: WakeLogEvent[] };

export function createScriptedWakeTransport(): ScriptedWakeTransport {
  throw new Error('createScriptedWakeTransport is not implemented');
}

export function createInMemoryWakeSecretBox(): WakeSecretBox {
  throw new Error('createInMemoryWakeSecretBox is not implemented');
}

export function createInMemoryWakeRepository(): WakeRepository {
  throw new Error('createInMemoryWakeRepository is not implemented');
}

export function createRecordingWakeObserver(): RecordingWakeObserver {
  throw new Error('createRecordingWakeObserver is not implemented');
}
