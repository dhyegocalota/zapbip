import type { ReactElement } from 'react';
import { createElement } from 'react';
import { SubscriberDigestShell } from '../subscriber-digest-template';

export default function SubscriberDigestPreview(): ReactElement {
  return createElement(SubscriberDigestShell);
}
