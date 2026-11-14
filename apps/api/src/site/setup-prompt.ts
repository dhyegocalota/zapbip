import type { WebLocale } from '@zapbip/types';
import { setupUrlOf } from './agentic-paths';
import { SiteCopyKey } from './site-copy';
import { copyOf } from './site-copy-text';

export function setupPromptOf(input: { locale: WebLocale; origin: string }): string {
  return copyOf({ locale: input.locale })(SiteCopyKey.StartPromptLine, { setupUrl: setupUrlOf(input) });
}
