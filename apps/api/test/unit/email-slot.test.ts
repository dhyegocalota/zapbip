import { describe, expect, it } from 'vitest';
import { EmailSlot, filledHtmlOf, filledTextOf, slotOf } from '../../src/emails/email-slot';

describe('the email slots', () => {
  it('writes a slot between double braces', () => {
    expect(slotOf(EmailSlot.Email)).toBe('{{email}}');
  });

  it('fills every occurrence of a slot in text as it is', () => {
    expect(filledTextOf({ text: '{{email}} and {{email}}', values: { [EmailSlot.Email]: 'a&b' } })).toBe('a&b and a&b');
  });

  it('escapes the values it writes into html', () => {
    expect(filledHtmlOf({ html: '<p>{{email}}</p>', values: { [EmailSlot.Email]: '<script>' } })).toBe('<p>&lt;script&gt;</p>');
  });

  it('leaves a slot it has no value for in place', () => {
    expect(filledTextOf({ text: '{{total}}', values: { [EmailSlot.Email]: 'x' } })).toBe('{{total}}');
  });
});
