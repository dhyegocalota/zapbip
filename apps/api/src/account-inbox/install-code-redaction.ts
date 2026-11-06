import { INSTALL_CODE_PREFIX, INSTALL_PAGE_PATH_PREFIX } from '@zapbip/types';

const INSTALL_CODE_BODY_LENGTH = 22;
const INSTALL_CODE_MASK = '*'.repeat(INSTALL_CODE_BODY_LENGTH);
const LINK_PREFIX = `${INSTALL_PAGE_PATH_PREFIX}${INSTALL_CODE_PREFIX}`;
const INSTALL_LINK_PATTERN = new RegExp(`(${LINK_PREFIX})[A-Za-z0-9_-]{${INSTALL_CODE_BODY_LENGTH}}`, 'g');
const SELECT_STATEMENT = 'SELECT id, payload FROM inbox_messages WHERE payload LIKE ?';
const UPDATE_STATEMENT = 'UPDATE inbox_messages SET payload = ? WHERE id = ?';

export function redactInstallCodes(input: { storage: DurableObjectStorage }): void {
  const { sql } = input.storage;
  sql
    .exec<{ id: string; payload: string }>(SELECT_STATEMENT, `%${LINK_PREFIX}%`)
    .toArray()
    .forEach((row) => sql.exec(UPDATE_STATEMENT, row.payload.replace(INSTALL_LINK_PATTERN, `$1${INSTALL_CODE_MASK}`), row.id));
}
