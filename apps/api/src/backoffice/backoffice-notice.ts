import { BackofficeCopyKey } from './backoffice-copy';

export enum BackofficeNotice {
  SignedOut = 'SignedOut',
  SessionEnded = 'SessionEnded',
  SignInFailed = 'SignInFailed',
  Registered = 'Registered',
  RegisteredWithBackfill = 'RegisteredWithBackfill',
  Verified = 'Verified',
  AccessTokenReplaced = 'AccessTokenReplaced',
  StateChanged = 'StateChanged',
  MetricsPeriodInvalid = 'MetricsPeriodInvalid',
  MetricsNumberNotFound = 'MetricsNumberNotFound',
}

export enum NoticeVariant {
  Info = 'info',
  Success = 'success',
  Warning = 'warning',
  Error = 'error',
}

export const NOTICE_VIEWS: Record<BackofficeNotice, { variant: NoticeVariant; copyKey: BackofficeCopyKey }> = {
  [BackofficeNotice.SignedOut]: { variant: NoticeVariant.Info, copyKey: BackofficeCopyKey.SignedOutNotice },
  [BackofficeNotice.SessionEnded]: { variant: NoticeVariant.Info, copyKey: BackofficeCopyKey.SessionEndedNotice },
  [BackofficeNotice.SignInFailed]: { variant: NoticeVariant.Error, copyKey: BackofficeCopyKey.SignInFailed },
  [BackofficeNotice.Registered]: { variant: NoticeVariant.Success, copyKey: BackofficeCopyKey.NoticeRegistered },
  [BackofficeNotice.RegisteredWithBackfill]: { variant: NoticeVariant.Success, copyKey: BackofficeCopyKey.NoticeRegisteredWithBackfill },
  [BackofficeNotice.Verified]: { variant: NoticeVariant.Success, copyKey: BackofficeCopyKey.NoticeVerified },
  [BackofficeNotice.AccessTokenReplaced]: { variant: NoticeVariant.Success, copyKey: BackofficeCopyKey.NoticeAccessTokenReplaced },
  [BackofficeNotice.StateChanged]: { variant: NoticeVariant.Success, copyKey: BackofficeCopyKey.NoticeStateChanged },
  [BackofficeNotice.MetricsPeriodInvalid]: { variant: NoticeVariant.Warning, copyKey: BackofficeCopyKey.NoticeMetricsPeriodInvalid },
  [BackofficeNotice.MetricsNumberNotFound]: { variant: NoticeVariant.Warning, copyKey: BackofficeCopyKey.NoticeMetricsNumberNotFound },
};

const NOTICE_VALUES: string[] = Object.values(BackofficeNotice);

export function noticeOf(input: { value: string | undefined }): BackofficeNotice | null {
  const { value } = input;
  if (value === undefined || !NOTICE_VALUES.includes(value)) return null;
  return value as BackofficeNotice;
}
