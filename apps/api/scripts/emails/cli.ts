import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { GENERATED_EMAILS_PATH, generatedEmailsSource } from './generated-emails';

enum EmailsCliMode {
  Generate = 'generate',
  Check = 'check',
}

const FAILURE_EXIT_CODE = 1;
const SUCCESS_EXIT_CODE = 0;
const STALE_MESSAGE = `${GENERATED_EMAILS_PATH} is stale; run pnpm emails:generate`;

async function generate(): Promise<number> {
  writeFileSync(GENERATED_EMAILS_PATH, await generatedEmailsSource());
  console.log(`wrote ${GENERATED_EMAILS_PATH}`);
  return SUCCESS_EXIT_CODE;
}

async function check(): Promise<number> {
  const current = existsSync(GENERATED_EMAILS_PATH) ? readFileSync(GENERATED_EMAILS_PATH, 'utf8') : '';
  if (current === (await generatedEmailsSource())) return SUCCESS_EXIT_CODE;
  console.error(STALE_MESSAGE);
  return FAILURE_EXIT_CODE;
}

const HANDLERS: Record<EmailsCliMode, () => Promise<number>> = {
  [EmailsCliMode.Generate]: generate,
  [EmailsCliMode.Check]: check,
};

const mode = process.argv[2] as EmailsCliMode;
if (!Object.values(EmailsCliMode).includes(mode)) throw new Error(`usage: cli.ts ${Object.values(EmailsCliMode).join(' | ')}`);
process.exitCode = await HANDLERS[mode]();
