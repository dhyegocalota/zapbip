import type { AccountMediaPurge } from '@zapbip/core';

const ACCOUNT_KEY_PREFIX = 'accounts';
const KEY_SEPARATOR = '/';
const LIST_PAGE_SIZE = 1_000;

export class R2AccountMedia implements AccountMediaPurge {
  private readonly bucket: R2Bucket;

  constructor(input: { bucket: R2Bucket }) {
    this.bucket = input.bucket;
  }

  async deleteAll(input: { accountId: string }): Promise<void> {
    const prefix = [ACCOUNT_KEY_PREFIX, input.accountId, ''].join(KEY_SEPARATOR);
    const page = await this.bucket.list({ prefix, limit: LIST_PAGE_SIZE });
    if (page.objects.length === 0) return;
    await this.bucket.delete(page.objects.map((object) => object.key));
    return this.deleteAll(input);
  }
}
