import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { connectorConfigJsonSchema } from '../src/connector-config';

const SCHEMA_FILE = fileURLToPath(new URL('../../docs/schemas/connector-config.json', import.meta.url));
const JSON_INDENT = 2;

await writeFile(SCHEMA_FILE, `${JSON.stringify(connectorConfigJsonSchema(), null, JSON_INDENT)}\n`);
