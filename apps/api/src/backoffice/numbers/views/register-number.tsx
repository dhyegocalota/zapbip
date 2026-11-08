import { BackofficeCopyKey, renderBackofficeCopy } from '../../backoffice-copy';
import { NoticeVariant } from '../../backoffice-notice';
import { BackofficePath } from '../../backoffice-paths';
import { CodeField } from '../../components/fields';
import { Notice } from '../../components/notice';
import { Layout } from '../../layout';
import type { PageContext } from '../../page-context';
import type { MetaAppRecord } from '../../../numbers/number-admin';
import { TextField } from '../components/text-field';
import { NEW_META_APP_VALUE, NumberFormField } from '../number-form-fields';
import { NumberSegment } from '../number-paths';
import type { FieldErrors, RegistrationValues } from '../registration-form';

export type RegisterNumberPageProps = {
  page: PageContext;
  metaApps: MetaAppRecord[];
  values: RegistrationValues;
  errors: FieldErrors;
  failure: BackofficeCopyKey | null;
};

export function RegisterNumberPage(props: RegisterNumberPageProps) {
  const { page, metaApps, values, errors, failure } = props;
  const { locale } = page;
  const translate = (key: BackofficeCopyKey): string => renderBackofficeCopy({ key, locale });
  const errorOf = (field: NumberFormField): string | null => {
    const key = errors[field];
    return key === undefined ? null : translate(key);
  };
  const hasFieldErrors = Object.keys(errors).length > 0;
  return (
    <Layout
      locale={locale}
      environment={page.environment}
      title={translate(BackofficeCopyKey.RegisterTitle)}
      stylesheetHref={page.stylesheetHref}
      csrfToken={page.csrfToken}
      signedIn
      currentPath={BackofficePath.Numbers}
      notice={page.notice}
    >
      <section class="card form-card" aria-labelledby="register-title">
        <h1 id="register-title">{translate(BackofficeCopyKey.RegisterTitle)}</h1>
        {failure === null ? null : <Notice variant={NoticeVariant.Error} locale={locale} message={translate(failure)} />}
        {hasFieldErrors ? (
          <Notice variant={NoticeVariant.Error} locale={locale} message={translate(BackofficeCopyKey.ErrorSummaryTitle)} />
        ) : null}
        <form method="post" action={`${BackofficePath.Numbers}/${NumberSegment.New}`}>
          <input type="hidden" name={NumberFormField.Csrf} value={page.csrfToken} />
          <fieldset>
            <legend>{translate(BackofficeCopyKey.RegisterMetaAppLegend)}</legend>
            <div class="field">
              <label for="meta-app">{translate(BackofficeCopyKey.RegisterMetaAppLabel)}</label>
              <select id="meta-app" name={NumberFormField.MetaApp}>
                {metaApps.map((metaApp) => (
                  <option value={metaApp.metaAppRef} selected={values.metaApp === metaApp.metaAppRef}>
                    {metaApp.label}
                  </option>
                ))}
                <option value={NEW_META_APP_VALUE} selected={values.metaApp === NEW_META_APP_VALUE || metaApps.length === 0}>
                  {translate(BackofficeCopyKey.RegisterMetaAppAddNew)}
                </option>
              </select>
            </div>
          </fieldset>
          <fieldset>
            <legend>{translate(BackofficeCopyKey.RegisterNewAppLegend)}</legend>
            <p class="field-help">{translate(BackofficeCopyKey.RegisterNewAppHelp)}</p>
            <TextField
              id="meta-app-id"
              name={NumberFormField.MetaAppId}
              label={translate(BackofficeCopyKey.RegisterMetaAppIdLabel)}
              help={translate(BackofficeCopyKey.RegisterMetaAppIdHelp)}
              value={values.metaAppId}
              error={errorOf(NumberFormField.MetaAppId)}
              inputmode="numeric"
            />
            <TextField
              id="meta-app-name"
              name={NumberFormField.MetaAppName}
              label={translate(BackofficeCopyKey.RegisterMetaAppNameLabel)}
              help={null}
              value={values.metaAppName}
              error={errorOf(NumberFormField.MetaAppName)}
            />
            <TextField
              id="app-secret"
              name={NumberFormField.AppSecret}
              label={translate(BackofficeCopyKey.RegisterAppSecretLabel)}
              help={translate(BackofficeCopyKey.RegisterAppSecretHelp)}
              value={null}
              error={errorOf(NumberFormField.AppSecret)}
              isSecret
            />
          </fieldset>
          <fieldset>
            <legend>{translate(BackofficeCopyKey.RegisterNumberLegend)}</legend>
            <TextField
              id="phone-number-id"
              name={NumberFormField.PhoneNumberId}
              label={translate(BackofficeCopyKey.RegisterPhoneNumberIdLabel)}
              help={translate(BackofficeCopyKey.RegisterPhoneNumberIdHelp)}
              value={values.phoneNumberId}
              error={errorOf(NumberFormField.PhoneNumberId)}
              inputmode="numeric"
            />
            <TextField
              id="waba-id"
              name={NumberFormField.WabaId}
              label={translate(BackofficeCopyKey.RegisterWabaIdLabel)}
              help={translate(BackofficeCopyKey.RegisterWabaIdHelp)}
              value={values.wabaId}
              error={errorOf(NumberFormField.WabaId)}
              inputmode="numeric"
            />
            <TextField
              id="display-number"
              name={NumberFormField.DisplayNumber}
              label={translate(BackofficeCopyKey.RegisterDisplayNumberLabel)}
              help={translate(BackofficeCopyKey.RegisterDisplayNumberHelp)}
              value={values.displayNumber}
              error={errorOf(NumberFormField.DisplayNumber)}
              inputmode="tel"
            />
            <TextField
              id="label"
              name={NumberFormField.Label}
              label={translate(BackofficeCopyKey.RegisterLabelLabel)}
              help={null}
              value={values.label}
              error={errorOf(NumberFormField.Label)}
            />
            <TextField
              id="access-token"
              name={NumberFormField.AccessToken}
              label={translate(BackofficeCopyKey.RegisterAccessTokenLabel)}
              help={translate(BackofficeCopyKey.RegisterAccessTokenHelp)}
              value={null}
              error={errorOf(NumberFormField.AccessToken)}
              isSecret
            />
          </fieldset>
          <fieldset>
            <legend>{translate(BackofficeCopyKey.RegisterConfirmLegend)}</legend>
            <CodeField locale={locale} id="register-code" />
          </fieldset>
          <button type="submit" class="button button-primary">
            {translate(BackofficeCopyKey.RegisterSubmit)}
          </button>
          <a href={BackofficePath.Numbers}>{translate(BackofficeCopyKey.RegisterCancel)}</a>
        </form>
      </section>
    </Layout>
  );
}
