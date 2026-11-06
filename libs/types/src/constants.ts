import { OwnerLocale } from './enums';

export const SECOND_MS = 1_000;
export const MINUTE_MS = 60 * SECOND_MS;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;
export const INSTALL_CODE_PREFIX = 'zb_inst_';
export const INSTALL_CODE_RANDOM_BYTES = 16;
export const INSTALL_CODE_TTL_MS = 30 * MINUTE_MS;
export const INSTALL_PAGE_PATH_PREFIX = '/i/';
export const BYTES_PER_KILOBYTE = 1_000;
export const BYTES_PER_MEGABYTE = 1_000_000;
export const DEFAULT_LOCALE = OwnerLocale.PortugueseBrazil;
