import { BackofficeCopyKey, renderBackofficeCopy } from '../backoffice-copy';
import { LABEL_MAX_LENGTH } from '../backoffice-constants';
import { NoticeVariant } from '../backoffice-notice';
import { BackofficePath } from '../backoffice-paths';
import { CodeField } from '../components/fields';
import { Notice } from '../components/notice';
import { formatTimestamp } from '../format-timestamp';
import { NumberFormField } from '../numbers/number-form-fields';
import type { PageContext } from '../page-context';
import { AGENT_KEY_STATUS_LABELS, AgentKeyStatus, agentKeyStatusOf } from './agent-key-status';
import { AgentKeyFormField } from './agent-key-form-fields';
import { AgentKeysShell } from './agent-keys-shell';
import type { OperatorKeyRecord } from './operator-key-store';
import { OPERATOR_KEY_DEFAULT_LIFETIME_DAYS, OPERATOR_KEY_MAX_LIFETIME_DAYS } from './operator-mcp-constants';

export type AgentKeysPageProps = {
  page: PageContext;
  failure: BackofficeCopyKey | null;
  keys: OperatorKeyRecord[];
  now: number;
};

const FAILURE_VALUES = { max: String(LABEL_MAX_LENGTH), days: String(OPERATOR_KEY_MAX_LIFETIME_DAYS) };

export function AgentKeysPage(props: AgentKeysPageProps) {
  const { page, failure, keys, now } = props;
  const { locale } = page;
  const translate = (key: BackofficeCopyKey, values?: Record<string, string>): string => renderBackofficeCopy({ key, locale, values });
  return (
    <AgentKeysShell page={page} title={BackofficeCopyKey.AgentKeysTitle}>
      <p>{translate(BackofficeCopyKey.AgentKeysIntro)}</p>
      {failure === null ? null : <Notice variant={NoticeVariant.Error} locale={locale} message={translate(failure, FAILURE_VALUES)} />}
      <section class="card form-card" aria-labelledby="agent-keys-create-title">
        <h2 id="agent-keys-create-title">{translate(BackofficeCopyKey.AgentKeysCreateTitle)}</h2>
        <form method="post" action={BackofficePath.AgentKeys}>
          <input type="hidden" name={NumberFormField.Csrf} value={page.csrfToken} />
          <div class="field">
            <label for="agent-key-label">{translate(BackofficeCopyKey.AgentKeysLabelLabel)}</label>
            <p id="agent-key-label-help" class="field-help">
              {translate(BackofficeCopyKey.AgentKeysLabelHelp, { max: String(LABEL_MAX_LENGTH) })}
            </p>
            <input
              id="agent-key-label"
              name={AgentKeyFormField.Label}
              type="text"
              maxlength={LABEL_MAX_LENGTH}
              autocomplete="off"
              aria-describedby="agent-key-label-help"
              required
            />
          </div>
          <div class="field">
            <label for="agent-key-lifetime">{translate(BackofficeCopyKey.AgentKeysLifetimeLabel)}</label>
            <p id="agent-key-lifetime-help" class="field-help">
              {translate(BackofficeCopyKey.AgentKeysLifetimeHelp, {
                default: String(OPERATOR_KEY_DEFAULT_LIFETIME_DAYS),
                max: String(OPERATOR_KEY_MAX_LIFETIME_DAYS),
              })}
            </p>
            <input
              id="agent-key-lifetime"
              name={AgentKeyFormField.LifetimeDays}
              type="number"
              min={1}
              max={OPERATOR_KEY_MAX_LIFETIME_DAYS}
              inputmode="numeric"
              autocomplete="off"
              aria-describedby="agent-key-lifetime-help"
            />
          </div>
          <CodeField locale={locale} id="agent-key-code" />
          <button type="submit" class="button button-primary">
            {translate(BackofficeCopyKey.AgentKeysCreateSubmit)}
          </button>
        </form>
      </section>
      <section class="card form-card" aria-labelledby="agent-keys-list-title">
        <h2 id="agent-keys-list-title">{translate(BackofficeCopyKey.AgentKeysListTitle)}</h2>
        {keys.length === 0 ? (
          <p class="empty-inline">{translate(BackofficeCopyKey.AgentKeysEmpty)}</p>
        ) : (
          <table class="data-table">
            <caption class="visually-hidden">{translate(BackofficeCopyKey.AgentKeysListTitle)}</caption>
            <thead>
              <tr>
                <th scope="col">{translate(BackofficeCopyKey.AgentKeysColumnLabel)}</th>
                <th scope="col">{translate(BackofficeCopyKey.AgentKeysColumnCreated)}</th>
                <th scope="col">{translate(BackofficeCopyKey.AgentKeysColumnLastUsed)}</th>
                <th scope="col">{translate(BackofficeCopyKey.AgentKeysColumnExpires)}</th>
                <th scope="col">{translate(BackofficeCopyKey.AgentKeysColumnStatus)}</th>
                <th scope="col">{translate(BackofficeCopyKey.AgentKeysColumnActions)}</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((record) => {
                const status = agentKeyStatusOf({ record, now });
                return (
                  <tr>
                    <td data-label={translate(BackofficeCopyKey.AgentKeysColumnLabel)} class="cell-truncate">
                      {record.label}
                    </td>
                    <td data-label={translate(BackofficeCopyKey.AgentKeysColumnCreated)} class="cell-nowrap">
                      <time datetime={new Date(record.createdAt).toISOString()}>{formatTimestamp({ at: record.createdAt })}</time>
                    </td>
                    <td data-label={translate(BackofficeCopyKey.AgentKeysColumnLastUsed)} class="cell-nowrap">
                      {record.lastUsedAt === null ? (
                        translate(BackofficeCopyKey.AgentKeysNeverUsed)
                      ) : (
                        <time datetime={new Date(record.lastUsedAt).toISOString()}>{formatTimestamp({ at: record.lastUsedAt })}</time>
                      )}
                    </td>
                    <td data-label={translate(BackofficeCopyKey.AgentKeysColumnExpires)} class="cell-nowrap">
                      <time datetime={new Date(record.expiresAt).toISOString()}>{formatTimestamp({ at: record.expiresAt })}</time>
                    </td>
                    <td data-label={translate(BackofficeCopyKey.AgentKeysColumnStatus)}>{translate(AGENT_KEY_STATUS_LABELS[status])}</td>
                    <td data-label={translate(BackofficeCopyKey.AgentKeysColumnActions)}>
                      {status === AgentKeyStatus.Active ? (
                        <form method="post" action={BackofficePath.AgentKeysRevoke}>
                          <input type="hidden" name={NumberFormField.Csrf} value={page.csrfToken} />
                          <input type="hidden" name={AgentKeyFormField.KeyId} value={record.id} />
                          <button
                            type="submit"
                            class="button button-secondary"
                            aria-label={translate(BackofficeCopyKey.AgentKeysRevokeFor, { label: record.label })}
                          >
                            {translate(BackofficeCopyKey.AgentKeysRevokeSubmit)}
                          </button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </AgentKeysShell>
  );
}

export function AgentKeyCreatedPage(props: { page: PageContext; operatorKey: string; endpoint: string; expiresAt: number }) {
  const { page, operatorKey, endpoint, expiresAt } = props;
  const translate = (key: BackofficeCopyKey, values?: Record<string, string>): string =>
    renderBackofficeCopy({ key, locale: page.locale, values });
  return (
    <AgentKeysShell page={page} title={BackofficeCopyKey.AgentKeysCreatedTitle}>
      <section class="card form-card" aria-labelledby="agent-key-created-title">
        <h2 id="agent-key-created-title">{translate(BackofficeCopyKey.AgentKeysCreatedKeyLabel)}</h2>
        <p class="field-help">{translate(BackofficeCopyKey.AgentKeysCreatedHelp)}</p>
        <textarea class="access-links mono" readonly rows={2} aria-labelledby="agent-key-created-title">
          {operatorKey}
        </textarea>
        <p>{translate(BackofficeCopyKey.AgentKeysCreatedExpires, { date: formatTimestamp({ at: expiresAt }) })}</p>
        <h2 id="agent-key-endpoint-title">{translate(BackofficeCopyKey.AgentKeysCreatedEndpointLabel)}</h2>
        <p class="mono agent-key-endpoint" aria-labelledby="agent-key-endpoint-title">
          {endpoint}
        </p>
        <p class="field-help">{translate(BackofficeCopyKey.AgentKeysCreatedHowTo)}</p>
      </section>
      <p>
        <a href={BackofficePath.AgentKeys} class="button button-secondary">
          {translate(BackofficeCopyKey.AgentKeysBack)}
        </a>
      </p>
    </AgentKeysShell>
  );
}
