import { WaitlistSource } from '@zapbip/types';
import { BackofficeCopyKey } from '../backoffice-copy';

export const SOURCE_LABELS: Record<WaitlistSource, BackofficeCopyKey> = {
  [WaitlistSource.Form]: BackofficeCopyKey.SourceForm,
  [WaitlistSource.Agent]: BackofficeCopyKey.SourceAgent,
};
