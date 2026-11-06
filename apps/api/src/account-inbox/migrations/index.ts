import type { Migration } from '../run-migrations';
import versionOneSql from './v1.sql';
import versionTwoSql from './v2.sql';
import versionThreeSql from './v3.sql';

export const ACCOUNT_INBOX_MIGRATIONS: Migration[] = [
  { version: 1, sql: versionOneSql },
  { version: 2, sql: versionTwoSql },
  { version: 3, sql: versionThreeSql },
];
