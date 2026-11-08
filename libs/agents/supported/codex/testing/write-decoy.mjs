import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const CONFIG_FILE_NAME = 'config.toml';

export async function writeDecoy(input) {
  await mkdir(input.homeDirectory, { recursive: true });
  await writeFile(join(input.homeDirectory, CONFIG_FILE_NAME), `[mcp_servers.${input.name}]\nurl = "${input.url}"\n`);
}
