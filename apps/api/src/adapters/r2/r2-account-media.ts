import type { AccountMediaPurge } from '@zapbip/core';

export class R2AccountMedia implements AccountMediaPurge {
  private readonly bucket: R2Bucket;

  constructor(input: { bucket: R2Bucket }) {
    this.bucket = input.bucket;
  }

  async deleteAll(input: { accountId: string }): Promise<void> {
    void input;
    void this.bucket;
    throw new Error('R2AccountMedia.deleteAll is not implemented');
  }
}
