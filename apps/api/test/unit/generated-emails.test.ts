import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GENERATED_EMAILS_PATH, generatedEmailsSource } from '../../scripts/emails/generated-emails';

describe('the generated email templates', () => {
  it('match what pnpm emails:generate renders from the React Email templates today', async () => {
    expect(readFileSync(GENERATED_EMAILS_PATH, 'utf8')).toBe(await generatedEmailsSource());
  });
});
