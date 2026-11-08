import { INSTALL_SELF_TEST_TEXT, OwnerLocale } from '@zapbip/types';
import { listenCommand } from './connector-commands';
import type { InstallSectionInput } from './install-section';

const MONITOR_WATCH_MAXIMUM_MINUTES = 30;

export type InstallStep = { action: string; success: string };

const CODE_FENCE = '```';

export type LocalizedSectionBuilder<Text> = (input: { section: InstallSectionInput; text: Text }) => string;

export type InstallProduct = { productName: string; productDescription: string };

export function formatSection(input: InstallProduct & { wakeNote: string; steps: InstallStep[] }): string {
  const stopCheck = `If you are not ${input.productDescription}, stop and run no other step of this section.`;
  const stopCheckStep: InstallStep = { action: stopCheck, success: `you are ${input.productDescription}, or you have stopped.` };
  const wakeStep = noticeStep(input.wakeNote);
  const selfTestStep = input.steps.slice(-1);
  const numberedSteps = [stopCheckStep, ...input.steps.slice(0, -1), wakeStep, ...selfTestStep].map(
    (step, index) => `${index + 1}. ${renderStep(step)}`,
  );
  return [`## ${input.productName}`, '', ...numberedSteps].join('\n');
}

function renderStep(step: InstallStep): string {
  const separator = step.action.endsWith(CODE_FENCE) ? '\n' : ' ';
  return `${step.action}${separator}Success: ${step.success}`;
}

export function tellOwner(text: string): string {
  return `Tell the owner: "${text}"`;
}

export function tellOwnerAndWait(text: string): string {
  return `${tellOwner(text)} Wait for the owner to answer before the next step.`;
}

export function noticeStep(text: string): InstallStep {
  return { action: tellOwner(text), success: 'the message is in the chat for the owner.' };
}

export function questionStep(text: string): InstallStep {
  return { action: tellOwnerAndWait(text), success: "the owner's answer is in the chat." };
}

export function chatSelfTest(locale: OwnerLocale): InstallStep {
  return {
    action: `In this chat, call send_message with the text "${INSTALL_SELF_TEST_TEXT[locale]}".`,
    success: 'send_message returns without an error.',
  };
}

export function monitoredListenStep(input: { connectionLink: string }): string {
  const watchLimit = `a watch lasts at most ${MONITOR_WATCH_MAXIMUM_MINUTES} minutes`;
  return `In a background terminal run \`${listenCommand(input)}\`. Watch it with Monitor and re-arm it on each timeout notice (${watchLimit}).`;
}

export function terminalListenStep(input: { connectionLink: string }): InstallStep {
  return {
    action: `In a background terminal run \`${listenCommand(input)}\` and keep that terminal running, with no time limit. Whenever a new line appears there, call check_inbox and answer.`,
    success: 'the background terminal is running and prints no error.',
  };
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
