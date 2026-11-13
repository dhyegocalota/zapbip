import { openDatabase } from '../../backoffice/support/operator-database';

const SET_STATE_STATEMENT = 'UPDATE accounts SET state = ? WHERE id = (SELECT account_id FROM owner_identities WHERE wa_id = ?)';

export function setAccountState(input: { phone: string; state: string }): void {
  const database = openDatabase();
  database.prepare(SET_STATE_STATEMENT).run(input.state, input.phone);
  database.close();
}
