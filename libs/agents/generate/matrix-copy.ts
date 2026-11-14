import { DocsPageLanguage } from '@zapbip/types';

export const MATRIX_HEADERS: Record<DocsPageLanguage, string[]> = {
  [DocsPageLanguage.English]: ['Agent', 'Wake type', 'Expected delay', 'Page'],
  [DocsPageLanguage.PortugueseBrazil]: ['IA', 'Tipo de despertar', 'Atraso esperado', 'Página'],
  [DocsPageLanguage.Spanish]: ['IA', 'Tipo de activación', 'Retraso esperado', 'Página'],
  [DocsPageLanguage.German]: ['KI', 'Weckart', 'Erwartete Verzögerung', 'Seite'],
  [DocsPageLanguage.French]: ['IA', 'Type de réveil', 'Délai attendu', 'Page'],
  [DocsPageLanguage.Japanese]: ['AI', '起動方式', '想定される遅延', 'ページ'],
  [DocsPageLanguage.Korean]: ['AI', '깨우기 방식', '예상 지연', '페이지'],
  [DocsPageLanguage.Chinese]: ['AI', '唤醒方式', '预期延迟', '页面'],
  [DocsPageLanguage.Arabic]: ['الذكاء الاصطناعي', 'نوع الإيقاظ', 'التأخير المتوقع', 'الصفحة'],
};

export const DELAY_NOT_MEASURED: Record<DocsPageLanguage, string> = {
  [DocsPageLanguage.English]: 'Not measured',
  [DocsPageLanguage.PortugueseBrazil]: 'Não medido',
  [DocsPageLanguage.Spanish]: 'Sin medir',
  [DocsPageLanguage.German]: 'Nicht gemessen',
  [DocsPageLanguage.French]: 'Non mesuré',
  [DocsPageLanguage.Japanese]: '未計測',
  [DocsPageLanguage.Korean]: '측정 안 됨',
  [DocsPageLanguage.Chinese]: '未测量',
  [DocsPageLanguage.Arabic]: 'لم يُقَس',
};
