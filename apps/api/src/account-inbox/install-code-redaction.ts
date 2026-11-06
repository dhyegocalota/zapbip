import { INSTALL_CODE_PREFIX, INSTALL_PAGE_PATH_PREFIX } from '@zapbip/types';

const INSTALL_CODE_BODY_LENGTH = 22;
const INSTALL_CODE_MASK = '*'.repeat(INSTALL_CODE_BODY_LENGTH);
const LINK_PREFIX = `${INSTALL_PAGE_PATH_PREFIX}${INSTALL_CODE_PREFIX}`;
const INSTALL_LINK_PATTERN = new RegExp(`(${LINK_PREFIX})[A-Za-z0-9_-]{${INSTALL_CODE_BODY_LENGTH}}`, 'g');
const SELECT_STATEMENT = 'SELECT id, payload FROM inbox_messages WHERE payload LIKE ?';
const UPDATE_STATEMENT = 'UPDATE inbox_messages SET payload = ? WHERE id = ?';

export function redactInstallCodes(input: { storage: DurableObjectStorage; messageIds: string[] }): void {
  throw new Error('redactInstallCodes is not implemented');
}
