import type { Migration } from '../run-migrations';
import versionOneSql from './v1.sql';
import versionSevenSql from './v7.sql';

export const ACCOUNT_INBOX_MIGRATIONS: Migration[] = [
  { version: 1, sql: versionOneSql },
  { version: 7, sql: versionSevenSql },
];
