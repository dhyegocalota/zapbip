export enum SubscriberDigestCopyKey {
  SubjectOne = 'subject_one',
  SubjectMany = 'subject_many',
  Preview = 'preview',
  Heading = 'heading',
  NewTitle = 'new_title',
  NoNewSubscribers = 'no_new_subscribers',
  SubscriberLine = 'subscriber_line',
  ReferredSubscriberLine = 'referred_subscriber_line',
  MoreSubscribers = 'more_subscribers',
  SourceForm = 'source_form',
  SourceAgent = 'source_agent',
  TotalsTitle = 'totals_title',
  TotalLine = 'total_line',
  LocalesTitle = 'locales_title',
  LocaleLine = 'locale_line',
  WelcomeTitle = 'welcome_title',
  WelcomeSentLine = 'welcome_sent_line',
  WelcomeFailedLine = 'welcome_failed_line',
  ReferrersTitle = 'referrers_title',
  ReferrerLine = 'referrer_line',
  NoReferrers = 'no_referrers',
  Footer = 'footer',
}

const SUBSCRIBER_DIGEST_COPY: Record<SubscriberDigestCopyKey, string> = {
  [SubscriberDigestCopyKey.SubjectOne]: 'zapbip · 1 novo inscrito ({date})',
  [SubscriberDigestCopyKey.SubjectMany]: 'zapbip · {count} novos inscritos ({date})',
  [SubscriberDigestCopyKey.Preview]: 'O resumo da lista de espera das últimas 24 horas.',
  [SubscriberDigestCopyKey.Heading]: 'Lista de espera nas últimas 24 horas',
  [SubscriberDigestCopyKey.NewTitle]: 'Novos inscritos',
  [SubscriberDigestCopyKey.NoNewSubscribers]: 'Nenhum inscrito novo nas últimas 24 horas.',
  [SubscriberDigestCopyKey.SubscriberLine]: '{time} · {email} · {language} · {source}',
  [SubscriberDigestCopyKey.ReferredSubscriberLine]: '{time} · {email} · {language} · {source} · indicado por {referrer}',
  [SubscriberDigestCopyKey.MoreSubscribers]: 'E mais {count} na exportação CSV do backoffice.',
  [SubscriberDigestCopyKey.SourceForm]: 'formulário',
  [SubscriberDigestCopyKey.SourceAgent]: 'agente',
  [SubscriberDigestCopyKey.TotalsTitle]: 'Total',
  [SubscriberDigestCopyKey.TotalLine]: 'Na lista: {total}',
  [SubscriberDigestCopyKey.LocalesTitle]: 'Por idioma',
  [SubscriberDigestCopyKey.LocaleLine]: '{language}: {total}',
  [SubscriberDigestCopyKey.WelcomeTitle]: 'E-mails de boas-vindas nas últimas 24 horas',
  [SubscriberDigestCopyKey.WelcomeSentLine]: 'Enviados: {count}',
  [SubscriberDigestCopyKey.WelcomeFailedLine]: 'Com falha: {count}',
  [SubscriberDigestCopyKey.ReferrersTitle]: 'Quem mais indicou nas últimas 24 horas',
  [SubscriberDigestCopyKey.ReferrerLine]: '{email}: {count}',
  [SubscriberDigestCopyKey.NoReferrers]: 'Ninguém indicou nas últimas 24 horas.',
  [SubscriberDigestCopyKey.Footer]: 'Resumo diário da lista de espera do zapbip, enviado para {recipient}.',
};

export function renderSubscriberDigestCopy(input: { key: SubscriberDigestCopyKey; values?: Record<string, string> }): string {
  const { key, values = {} } = input;
  return Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, value), SUBSCRIBER_DIGEST_COPY[key]);
}
