import { HttpStatus, type WhatsAppNumberState } from '@zapbip/types';
import type { Context } from 'hono';
import { numberAdminOf } from '../../adapters/d1/d1-number-admin';
import type { NumberListEntry } from '../../numbers/number-admin';
import { allowedTargetsOf } from '../../numbers/number-state';
import type { BackofficeCopyKey } from '../backoffice-copy';
import type { BackofficeEnv } from '../backoffice-env';
import { errorResponse } from '../error-response';
import { signedInPageContext } from '../page-context';
import { NumberDetailPage } from './views/number-detail';

export type DetailStatus = HttpStatus.Ok | HttpStatus.Unauthorized | HttpStatus.UnprocessableEntity;

export async function findNumberEntry(input: { context: Context<BackofficeEnv>; numberId: string }): Promise<NumberListEntry | null> {
  const entries = await numberAdminOf({ bindings: input.context.env }).listNumbers();
  const entry = entries.find((candidate) => candidate.numberId === input.numberId);
  return entry === undefined ? null : entry;
}

export async function detailResponse(input: {
  context: Context<BackofficeEnv>;
  numberId: string;
  status: DetailStatus;
  failure: BackofficeCopyKey | null;
  selectedState?: WhatsAppNumberState;
}): Promise<Response> {
  const { context, numberId, status, failure, selectedState = null } = input;
  const entries = await numberAdminOf({ bindings: context.env }).listNumbers();
  const entry = entries.find((candidate) => candidate.numberId === numberId);
  if (entry === undefined) return errorResponse({ context, status: HttpStatus.NotFound });
  const siblingLabels = entries.filter((candidate) => candidate.metaAppRef === entry.metaAppRef).map((candidate) => candidate.label);
  const allowedTargets = allowedTargetsOf({ from: entry.state, verifiedAt: entry.verifiedAt });
  const page = await signedInPageContext({ context });
  return context.html(
    <NumberDetailPage
      page={page}
      entry={entry}
      siblingLabels={siblingLabels}
      allowedTargets={allowedTargets}
      failure={failure}
      selectedState={selectedState}
    />,
    status,
  );
}
