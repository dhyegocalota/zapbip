import { DocsLanguage } from '@zapbip/types';

export const MATRIX_HEADERS: Record<DocsLanguage, string[]> = {
  [DocsLanguage.English]: ['Agent', 'Wake type', 'Expected delay', 'Page'],
  [DocsLanguage.PortugueseBrazil]: ['IA', 'Tipo de despertar', 'Atraso esperado', 'Página'],
};

export const DELAY_NOT_MEASURED: Record<DocsLanguage, string> = {
  [DocsLanguage.English]: 'Not measured',
  [DocsLanguage.PortugueseBrazil]: 'Não medido',
};
