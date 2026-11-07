import type { Migration } from '../run-migrations';
import versionFourSql from './v4.sql';
import versionOneSql from './v1.sql';
import versionTwoSql from './v2.sql';

export const ACCOUNT_INBOX_MIGRATIONS: Migration[] = [
  { version: 1, sql: versionOneSql },
  { version: 2, sql: versionTwoSql },
  { version: 4, sql: versionFourSql },
];
