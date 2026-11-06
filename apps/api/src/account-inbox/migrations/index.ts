import type { Migration } from '../run-migrations';
import versionOneSql from './v1.sql';

export const ACCOUNT_INBOX_MIGRATIONS: Migration[] = [{ version: 1, sql: versionOneSql }];
