import { createHash } from 'node:crypto';

export const BACKOFFICE_TEST_KEY = `zb_bo_${'K'.repeat(43)}`;
export const BACKOFFICE_TEST_KEY_DIGEST = createHash('sha256').update(BACKOFFICE_TEST_KEY).digest('hex');
export const BACKOFFICE_TEST_PASSWORD_PEPPER = 'backoffice-test-password-pepper';
export const BACKOFFICE_TEST_TOTP_SECRET = 'JBSWY3DPEHPK3PXP';
