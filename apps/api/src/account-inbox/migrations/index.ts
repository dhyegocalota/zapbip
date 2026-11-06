import type { Migration } from '../run-migrations';
import versionFourSql from './v4.sql';
import versionOneSql from './v1.sql';

export const ACCOUNT_INBOX_MIGRATIONS: Migration[] = [
  { version: 1, sql: versionOneSql },
  { version: 4, sql: versionFourSql },
];
