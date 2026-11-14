import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { OwnerLocale, TemplateKind } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { WhatsAppLanguageCode, WhatsAppTemplateName } from '../../src/adapters/whatsapp/whatsapp-enums';
import {
  OWNER_LOCALE_TO_LANGUAGE_CODE,
  TEMPLATE_NAME_BY_KIND,
  WHATSAPP_TEMPLATE_BODIES,
  WHATSAPP_TEMPLATE_QUICK_REPLIES,
} from '../../src/adapters/whatsapp/whatsapp-templates';
import { assertTemplateBodyHasFixedWords } from '../../src/adapters/whatsapp/template-sanitiser';

const RUNBOOK = readFileSync(join(import.meta.dirname, '../../../../docs/runbooks/meta-setup.md'), 'utf8');

describe('WhatsApp templates', () => {
  it.each(Object.values(WhatsAppTemplateName).flatMap((name) => Object.values(WhatsAppLanguageCode).map((code) => [name, code] as const)))(
    'lists %s in %s with its exact body and quick reply in the Meta runbook',
    (name, code) => {
      expect(RUNBOOK).toContain(`\`${name}\` | \`${code}\` | \`${WHATSAPP_TEMPLATE_BODIES[name][code]}\``);
      expect(RUNBOOK).toContain(`\`${WHATSAPP_TEMPLATE_QUICK_REPLIES[name][code]}\` |`);
    },
  );

  it('AU-116 keeps the registered template bodies', () => {
    expect(WHATSAPP_TEMPLATE_BODIES[WhatsAppTemplateName.AgentNotice]).toMatchObject({
      [WhatsAppLanguageCode.PortugueseBrazil]: 'Mensagem de {{1}}: {{2}} — toque em Abrir para ler.',
      [WhatsAppLanguageCode.EnglishUs]: 'Message from {{1}}: {{2}} — tap Open to read it.',
    });
    expect(WHATSAPP_TEMPLATE_BODIES[WhatsAppTemplateName.AgentQuestion]).toMatchObject({
      [WhatsAppLanguageCode.PortugueseBrazil]: 'Pergunta de {{1}}: {{2}} — toque em Responder para ver as opções.',
      [WhatsAppLanguageCode.EnglishUs]: 'Question from {{1}}: {{2}} — tap Reply to see the options.',
    });
  });

  it.each(Object.values(WhatsAppTemplateName))('keeps %s for every language with its two variables', (name) => {
    expect(Object.keys(WHATSAPP_TEMPLATE_BODIES[name]).sort()).toEqual(Object.values(WhatsAppLanguageCode).sort());
    Object.values(WHATSAPP_TEMPLATE_BODIES[name]).forEach((body) => {
      expect(body).toContain('{{1}}');
      expect(body).toContain('{{2}}');
    });
  });

  it.each(Object.values(WhatsAppTemplateName))('keeps the quick reply of %s within the WhatsApp limit in every language', (name) => {
    expect(Object.keys(WHATSAPP_TEMPLATE_QUICK_REPLIES[name]).sort()).toEqual(Object.values(WhatsAppLanguageCode).sort());
    Object.values(WHATSAPP_TEMPLATE_QUICK_REPLIES[name]).forEach((reply) => expect([...reply].length).toBeLessThanOrEqual(25));
  });

  it.each(Object.values(WHATSAPP_TEMPLATE_BODIES).flatMap((bodies) => Object.values(bodies)))(
    'AU-117 starts and ends with fixed words: %s',
    (body) => {
      expect(() => assertTemplateBodyHasFixedWords({ body })).not.toThrow();
    },
  );

  it('AU-96 maps each owner locale to its language code, and the six new languages to the English template until theirs is approved', () => {
    expect(OWNER_LOCALE_TO_LANGUAGE_CODE).toEqual({
      [OwnerLocale.PortugueseBrazil]: WhatsAppLanguageCode.PortugueseBrazil,
      [OwnerLocale.EnglishUs]: WhatsAppLanguageCode.EnglishUs,
      [OwnerLocale.Spanish]: WhatsAppLanguageCode.EnglishUs,
      [OwnerLocale.German]: WhatsAppLanguageCode.EnglishUs,
      [OwnerLocale.French]: WhatsAppLanguageCode.EnglishUs,
      [OwnerLocale.Japanese]: WhatsAppLanguageCode.EnglishUs,
      [OwnerLocale.Korean]: WhatsAppLanguageCode.EnglishUs,
      [OwnerLocale.ChineseSimplified]: WhatsAppLanguageCode.EnglishUs,
    });
    expect(Object.keys(OWNER_LOCALE_TO_LANGUAGE_CODE).sort()).toEqual(Object.values(OwnerLocale).sort());
  });

  it('names the template of each kind', () => {
    expect(TEMPLATE_NAME_BY_KIND).toEqual({
      [TemplateKind.Notice]: WhatsAppTemplateName.AgentNotice,
      [TemplateKind.QuestionNotice]: WhatsAppTemplateName.AgentQuestion,
    });
  });
});
