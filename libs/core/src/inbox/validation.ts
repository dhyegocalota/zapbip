import type { OptionRender } from '@zapbip/types';
import type { MediaMessageKind } from './constants';
import type { AgentName } from './connection';

export function parseAgentName(input: { value: string }): AgentName {
  void input;
  throw new Error('parseAgentName is not implemented');
}

export function normalizeText(input: { value: string }): string {
  void input;
  throw new Error('normalizeText is not implemented');
}

export function assertMaxChars(input: { field: string; value: string; maxChars: number }): void {
  void input;
  throw new Error('assertMaxChars is not implemented');
}

export function parseOptions(input: { options: string[] }): { render: OptionRender; titles: string[] } {
  void input;
  throw new Error('parseOptions is not implemented');
}

export function parseTimeoutMs(input: { seconds: number }): number {
  void input;
  throw new Error('parseTimeoutMs is not implemented');
}

export function parseEmoji(input: { emoji: string }): string | null {
  void input;
  throw new Error('parseEmoji is not implemented');
}

export function assertHttpsLink(input: { value: string }): void {
  void input;
  throw new Error('assertHttpsLink is not implemented');
}

export function assertMediaFits(input: { kind: MediaMessageKind; mimeType: string | null; sizeBytes: number | null }): void {
  void input;
  throw new Error('assertMediaFits is not implemented');
}

export function assertUploadDeclaration(input: { mimeType: string; sizeBytes: number }): void {
  void input;
  throw new Error('assertUploadDeclaration is not implemented');
}

export function parseOptionDescriptions(input: { descriptions: (string | null)[] }): (string | null)[] {
  void input;
  throw new Error('parseOptionDescriptions is not implemented');
}

export function assertVoiceNote(input: { kind: MediaMessageKind; voice: boolean }): void {
  void input;
  throw new Error('assertVoiceNote is not implemented');
}
