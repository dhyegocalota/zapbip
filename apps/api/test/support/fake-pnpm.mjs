import { appendFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const COMMAND_FLAG = '--command';
const argumentsList = process.argv.slice(2);
appendFileSync(process.env.OPERATOR_TEST_LOG, `${JSON.stringify(argumentsList)}\n`);
const sql = argumentsList[argumentsList.indexOf(COMMAND_FLAG) + 1];
const database = new DatabaseSync(process.env.OPERATOR_TEST_DATABASE);
const { changes } = database.prepare(sql).run();
database.close();
process.stdout.write(JSON.stringify([{ results: [], success: true, meta: { changes } }]));
