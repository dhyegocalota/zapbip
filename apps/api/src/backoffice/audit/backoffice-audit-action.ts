export enum BackofficeAuditAction {
  OperatorEnrolled = 'operator.enrolled',
  SignInSucceeded = 'sign_in.succeeded',
  SignInFailed = 'sign_in.failed',
  SignInLocked = 'sign_in.locked',
  StepUpFailed = 'step_up.failed',
  SignOut = 'sign_out',
  NumberRegistered = 'number.registered',
  NumberVerified = 'number.verified',
  NumberAccessTokenRotated = 'number.access_token_rotated',
  MetaAppSecretRotated = 'meta_app.app_secret_rotated',
  NumberStateChanged = 'number.state_changed',
}

export enum BackofficeAuditTargetKind {
  Number = 'number',
  MetaApp = 'meta_app',
}

export enum BackofficeAuditOutcome {
  Succeeded = 'succeeded',
  Failed = 'failed',
  Locked = 'locked',
}
