import { INSTALL_SELF_TEST_TEXT, OwnerLocale, type InstallClient } from '@zapbip/types';
import { INSTALL_PRODUCTS } from '../install-products';
import { listenCommand } from './connector-commands';
import { wakeNoteOf } from './wake-notes';
import type { InstallSectionInput } from './install-section';

const MONITOR_WATCH_MAXIMUM_MINUTES = 30;

export type LocalizedSectionBuilder<Text> = (input: { section: InstallSectionInput; text: Text }) => string;

export function formatSection(input: { client: InstallClient; locale: OwnerLocale; standbyAgent: string | null; steps: string[] }): string {
  const product = INSTALL_PRODUCTS[input.client];
  const stopCheck = `If you are not ${product.description}, stop and run no other step of this section.`;
  const wakeStep = tellOwner(wakeNoteOf(input));
  const selfTestStep = input.steps.slice(-1);
  const numberedSteps = [stopCheck, ...input.steps.slice(0, -1), wakeStep, ...selfTestStep].map((step, index) => `${index + 1}. ${step}`);
  return [`## ${product.name}`, '', ...numberedSteps].join('\n');
}

export function tellOwner(text: string): string {
  return `Tell the owner: "${text}"`;
}

export function tellOwnerAndWait(text: string): string {
  return `${tellOwner(text)} Wait for the owner to answer before the next step.`;
}

export function chatSelfTest(locale: OwnerLocale): string {
  return `In this chat, call send_message with the text "${INSTALL_SELF_TEST_TEXT[locale]}".`;
}

export function monitoredListenStep(input: { connectionLink: string }): string {
  const watchLimit = `a watch lasts at most ${MONITOR_WATCH_MAXIMUM_MINUTES} minutes`;
  return `In a background terminal run \`${listenCommand(input)}\`. Watch it with Monitor and re-arm it on each timeout notice (${watchLimit}).`;
}

export function terminalListenStep(input: { connectionLink: string }): string {
  return `In a background terminal run \`${listenCommand(input)}\` and keep that terminal running, with no time limit. Whenever a new line appears there, call check_inbox and answer.`;
}

export function localizeCopy<Text>(input: {
  texts: Record<OwnerLocale, Text>;
  build: LocalizedSectionBuilder<Text>;
}): Record<OwnerLocale, (section: InstallSectionInput) => string> {
  return {
    [OwnerLocale.PortugueseBrazil]: (section) => input.build({ section, text: input.texts[OwnerLocale.PortugueseBrazil] }),
    [OwnerLocale.EnglishUs]: (section) => input.build({ section, text: input.texts[OwnerLocale.EnglishUs] }),
  };
}
