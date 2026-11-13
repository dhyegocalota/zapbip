export enum BatchCount {
  Selected = 'selected',
  Released = 'released',
  AlreadyActive = 'alreadyActive',
  NotReleasable = 'notReleasable',
  Sent = 'sent',
  Queued = 'queued',
  Failed = 'failed',
  ItemFailed = 'itemFailed',
  Issued = 'issued',
  Skipped = 'skipped',
}

export type BatchCounts = Partial<Record<BatchCount, number>>;

const COUNT_SEPARATOR = ' ';

export function auditTargetOf(input: { counts: BatchCounts }): string {
  return Object.entries(input.counts)
    .map(([name, count]) => `${name}=${count}`)
    .join(COUNT_SEPARATOR);
}

export function failedBatchCounts(input: { selected: number }): BatchCounts {
  return { [BatchCount.Selected]: input.selected, [BatchCount.ItemFailed]: input.selected };
}
