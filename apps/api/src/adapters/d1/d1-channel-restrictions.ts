export type ChannelRestrictions = {
  findActive(input: { now: number }): Promise<{ errorCode: number } | null>;
  record(input: { errorCode: number; restrictedAt: number }): Promise<void>;
};

export class D1ChannelRestrictions implements ChannelRestrictions {
  constructor(input: { database: D1Database; phoneNumberId: string }) {
    void input;
  }

  findActive(input: { now: number }): Promise<{ errorCode: number } | null> {
    void input;
    throw new Error('D1ChannelRestrictions.findActive is not implemented');
  }

  record(input: { errorCode: number; restrictedAt: number }): Promise<void> {
    void input;
    throw new Error('D1ChannelRestrictions.record is not implemented');
  }
}
