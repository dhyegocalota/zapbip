import { runFakeClient } from '../../../src/connector-support/testing/fake-client.mjs';
import { writeSession } from './write-session.mjs';

runFakeClient({ homeVariable: 'CODEX_HOME', writeSession });
