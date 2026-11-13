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
  WaitlistExported = 'waitlist.exported',
  ReferralCapChanged = 'waitlist.referral_cap_changed',
  AccessReleased = 'access.released',
  WaitlistInvited = 'waitlist.invited',
  WaitlistListed = 'waitlist.listed',
  AgentKeyCreated = 'agent_key.created',
  AgentKeyRevoked = 'agent_key.revoked',
}

export enum BackofficeAuditTargetKind {
  Number = 'number',
  MetaApp = 'meta_app',
  Waitlist = 'waitlist',
  Access = 'access',
  AgentKey = 'agent_key',
}

export enum BackofficeAuditOutcome {
  Succeeded = 'succeeded',
  Failed = 'failed',
  Locked = 'locked',
}
