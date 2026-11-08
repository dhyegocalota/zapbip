import { testEnv } from '../support/workers-env';
import { backofficeEnv } from './backoffice-auth-fixtures';

type RecordedStatement = { sql: string; statement: D1PreparedStatement };

export type BatchRecording = { env: ReturnType<typeof backofficeEnv>; batches: string[][]; prepared: string[] };

function recordedOf(input: { recorded: WeakMap<object, RecordedStatement>; statement: object }): RecordedStatement {
  const entry = input.recorded.get(input.statement);
  if (entry === undefined) throw new Error('a batched statement was not prepared through the recorder');
  return entry;
}

export function recordingEnvironment(): BatchRecording {
  const batches: string[][] = [];
  const prepared: string[] = [];
  const recorded = new WeakMap<object, RecordedStatement>();
  const database = new Proxy(testEnv.CONNECTIONS, {
    get(target, property) {
      if (property === 'prepare')
        return (sql: string) => {
          prepared.push(sql);
          const statement = target.prepare(sql);
          const recorder = new Proxy(statement, {
            get(source, statementProperty) {
              const member = Reflect.get(source, statementProperty);
              if (statementProperty !== 'bind') return typeof member === 'function' ? member.bind(source) : member;
              return (...values: unknown[]) => {
                const bound = source.bind(...values);
                recorded.set(bound, { sql, statement: bound });
                return bound;
              };
            },
          });
          recorded.set(recorder, { sql, statement });
          return recorder;
        };
      if (property === 'batch')
        return (statements: D1PreparedStatement[]) => {
          const entries = statements.map((statement) => recordedOf({ recorded, statement }));
          batches.push(entries.map((entry) => entry.sql));
          return target.batch(entries.map((entry) => entry.statement));
        };
      const member = Reflect.get(target, property);
      return typeof member === 'function' ? member.bind(target) : member;
    },
  });
  return { env: backofficeEnv({ overrides: { CONNECTIONS: database } }), batches, prepared };
}
