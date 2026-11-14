export type GeneratedEmailPart = { html: string; text: string };
export type GeneratedEmail = GeneratedEmailPart & { subject: string };
export type GeneratedDigestEmail = { shell: GeneratedEmailPart; row: GeneratedEmailPart };
