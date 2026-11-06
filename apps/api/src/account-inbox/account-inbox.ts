import { DurableObject } from 'cloudflare:workers';
import type { Clock, MessageSender } from '@zapbip/core';
import type { AccountInboxRpc } from '../contract/account-inbox-rpc';
import type { DueTimeProvider } from '../contract/due-time-provider';
import type { Bindings } from '../contract/env';

export class AccountInbox extends DurableObject<Bindings> implements AccountInboxRpc {
  protected sender!: MessageSender;
  protected clock!: Clock;
  protected readonly dueTimeProviders: DueTimeProvider[] = [];

  protected armAlarm(): Promise<void> {
    throw new Error('armAlarm is not implemented');
  }

  alarm(): Promise<void> {
    void 0;
    throw new Error('alarm is not implemented');
  }

  sendText(input: never): never {
    void input;
    throw new Error('sendText is not implemented');
  }

  sendMedia(input: never): never {
    void input;
    throw new Error('sendMedia is not implemented');
  }

  sendLocation(input: never): never {
    void input;
    throw new Error('sendLocation is not implemented');
  }

  sendContacts(input: never): never {
    void input;
    throw new Error('sendContacts is not implemented');
  }

  react(input: never): never {
    void input;
    throw new Error('react is not implemented');
  }

  ask(input: never): never {
    void input;
    throw new Error('ask is not implemented');
  }

  waitForReply(input: never): never {
    void input;
    throw new Error('waitForReply is not implemented');
  }

  getMessages(input: never): never {
    void input;
    throw new Error('getMessages is not implemented');
  }

  checkInbox(input: never): never {
    void input;
    throw new Error('checkInbox is not implemented');
  }

  createUpload(input: never): never {
    void input;
    throw new Error('createUpload is not implemented');
  }

  describeUpload(input: never): never {
    void input;
    throw new Error('describeUpload is not implemented');
  }

  completeUpload(input: never): never {
    void input;
    throw new Error('completeUpload is not implemented');
  }

  receiveOwnerMessage(input: never): never {
    void input;
    throw new Error('receiveOwnerMessage is not implemented');
  }
}
