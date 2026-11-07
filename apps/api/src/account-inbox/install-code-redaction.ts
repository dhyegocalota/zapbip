import { INSTALL_CODE_PREFIX, INSTALL_PAGE_PATH_PREFIX } from '@zapbip/types';

const INSTALL_CODE_BODY_LENGTH = 22;
const INSTALL_CODE_MASK = '*'.repeat(INSTALL_CODE_BODY_LENGTH);
const LINK_PREFIX = `${INSTALL_PAGE_PATH_PREFIX}${INSTALL_CODE_PREFIX}`;
const INSTALL_LINK_PATTERN = new RegExp(`(${LINK_PREFIX})[A-Za-z0-9_-]{${INSTALL_CODE_BODY_LENGTH}}`, 'g');
const SELECT_STATEMENT = 'SELECT payload FROM inbox_messages WHERE id = ?';
const UPDATE_STATEMENT = 'UPDATE inbox_messages SET payload = ? WHERE id = ?';

function redactMessage(input: { sql: SqlStorage; messageId: string }): void {
  const { sql, messageId } = input;
  const rows = sql.exec<{ payload: string }>(SELECT_STATEMENT, messageId).toArray();
  rows.forEach(({ payload }) => {
    const redacted = payload.replace(INSTALL_LINK_PATTERN, `$1${INSTALL_CODE_MASK}`);
    if (redacted === payload) return;
    sql.exec(UPDATE_STATEMENT, redacted, messageId);
  });
}

export function redactInstallCodes(input: { storage: DurableObjectStorage; messageIds: string[] }): void {
  const { sql } = input.storage;
  input.messageIds.forEach((messageId) => redactMessage({ sql, messageId }));
}
