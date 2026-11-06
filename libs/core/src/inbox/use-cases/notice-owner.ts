import { MessageKind, TemplateKind, type OwnerLocale } from '@zapbip/types';
import { buildNoticePreview } from '../inbox-copy';
import type { Message } from '../message';
import type { CoreDependencies } from '../ports';

async function noticePreview(input: { dependencies: CoreDependencies; message: Message; locale: OwnerLocale }): Promise<string> {
  const { message, locale } = input;
  if (message.kind !== MessageKind.Choice) return buildNoticePreview({ content: message, locale });
  const question = await input.dependencies.repository.findQuestion({ questionId: message.questionId });
  if (question === null) return buildNoticePreview({ content: message, locale });
  return buildNoticePreview({ content: { kind: MessageKind.Text, text: question.text }, locale });
}

async function releaseNotice(input: { dependencies: CoreDependencies }): Promise<void> {
  const { repository } = input.dependencies;
  const window = await repository.findWindow();
  await repository.saveWindow({ window: { ...window, noticeSentForClosedWindow: false } });
}

export async function noticeOwner(input: { dependencies: CoreDependencies; ownerLocale: OwnerLocale; message: Message }): Promise<void> {
  const { dependencies, ownerLocale, message } = input;
  const { repository, sender } = dependencies;
  if (message.agent === null) return;
  const isNoticeOwner = await repository.claimNotice();
  if (!isNoticeOwner) return;
  const preview = await noticePreview({ dependencies, message, locale: ownerLocale });
  const kind = message.kind === MessageKind.Choice ? TemplateKind.QuestionNotice : TemplateKind.Notice;
  try {
    await sender.template({ kind, locale: ownerLocale, parameters: [message.agent, preview] });
  } catch (error) {
    await releaseNotice({ dependencies });
    throw error;
  }
}
