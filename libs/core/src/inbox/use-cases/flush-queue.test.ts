import { ChannelErrorKind, IdPrefix, MessageKind, OwnerLocale, TemplateKind } from '@zapbip/types';
import { describe, expect, test } from 'vitest';
import { buildNoticePreview } from '../inbox-copy';
import { channelError } from '../testing/channel-fixtures';
import { closeWindow, connectionOf, createEnvironment, openWindow } from '../testing/fixtures';
import { deliverToOwner } from './deliver-to-owner';
import { flushQueue } from './flush-queue';
import { sendText } from './send-text';

const LOCALE = OwnerLocale.PortugueseBrazil;

describe('flushQueue', () => {
  test('a zapbip note queued ahead of an agent message: the closed-window notice names the agent and previews its message', async () => {
    const environment = await createEnvironment();
    const { dependencies } = environment;
    await closeWindow({ environment });
    await deliverToOwner({
      dependencies,
      ownerLocale: LOCALE,
      agent: null,
      messageId: dependencies.ids.next({ prefix: IdPrefix.Message }),
      content: { kind: MessageKind.Text, text: 'note from zapbip' },
      replyToMessageId: null,
    });
    await sendText({ dependencies, connection: connectionOf({ agent: 'alpha' }), text: 'oi', replyToMessageId: null });
    await openWindow({ environment });
    environment.sender.failSessionCalls({
      callNumbers: [1],
      error: channelError({ kind: ChannelErrorKind.WindowClosed, errorCode: 131047 }),
    });
    await flushQueue({ dependencies, ownerLocale: LOCALE });
    expect(environment.sender.templates.at(-1)).toEqual({
      kind: TemplateKind.Notice,
      locale: LOCALE,
      parameters: ['alpha', buildNoticePreview({ content: { kind: MessageKind.Text, text: 'oi' }, locale: LOCALE })],
    });
  });
});
