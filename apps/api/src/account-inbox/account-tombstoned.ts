export class AccountTombstoned extends Error {
  constructor() {
    super('AccountTombstoned');
    this.name = 'AccountTombstoned';
  }
}
