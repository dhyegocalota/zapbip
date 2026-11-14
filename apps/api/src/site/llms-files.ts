import { WebLocale } from '@zapbip/types';
import { LlmsFile, llmsPathOf, markdownPathOf } from './agentic-paths';
import { legalTextOf } from './legal-copy';
import { LEGAL_PAGES, legalPathOf } from './legal-links';
import { homeMarkdownOf, legalMarkdownOf } from './markdown-pages';
import { type MarkdownBlock, MarkdownBlockKind, renderMarkdown } from './markdown-document';
import { pricingValuesOf } from './price-format';
import { leadingAgentNames } from './site-agents';
import { SiteCopyKey } from './site-copy';
import { copyOf } from './site-copy-text';
import { languageOf } from '../web-shell/locale-profiles';
import { DOCS_ORIGIN, SitePath } from './site-paths';
import { localePathOf } from './site-language';

const SECTION_LEVEL = 2;
const PAGE_LEVEL = 1;
const PAGES_HEADING = 'Pages';
const INTERFACES_HEADING = 'Interfaces';
const DOCS_HEADING = 'Docs';
const OPTIONAL_HEADING = 'Optional';
const FULL_SEPARATOR = '\n';

type LinkEntry = { title: string; url: string; description: string };

const INTERFACES: { path: SitePath; title: string; description: string }[] = [
  {
    path: SitePath.RequestAccess,
    title: 'Request access',
    description: 'POST a JSON body {"email", "language"} to add a person to the early access list; no captcha',
  },
  { path: SitePath.Pricing, title: 'Pricing', description: 'GET the plans as JSON; add ?language= for another language' },
  { path: SitePath.QuickStart, title: 'Quick start', description: 'GET the connection steps of one agent as JSON; add ?agent=' },
  { path: SitePath.McpServerCard, title: 'MCP server card', description: 'Where the zapbip MCP server lives and how it authenticates' },
  { path: SitePath.AgentCard, title: 'Agent card', description: 'The public skills of this site' },
  { path: SitePath.SecurityText, title: 'Security contact', description: 'How to report a vulnerability' },
];
const DOCS_LINKS: { path: string; title: string; description: string }[] = [
  { path: '/llms.txt', title: 'Docs llms.txt', description: 'The index of the documentation, in Markdown' },
  { path: '/llms-full.txt', title: 'Docs llms-full.txt', description: 'The whole documentation, in Markdown' },
  { path: '/mcp', title: 'Docs MCP server', description: 'Search the documentation through MCP' },
];

function linkList(input: { entries: LinkEntry[] }): MarkdownBlock {
  return {
    kind: MarkdownBlockKind.List,
    isOrdered: false,
    items: input.entries.map((entry) => `[${entry.title}](${entry.url}): ${entry.description}`),
  };
}

function section(input: { title: string; entries: LinkEntry[] }): MarkdownBlock[] {
  return [{ kind: MarkdownBlockKind.Heading, level: SECTION_LEVEL, text: input.title }, linkList({ entries: input.entries })];
}

export function llmsTextOf(input: { origin: string; locale: WebLocale }): string {
  const { origin, locale } = input;
  const translate = copyOf({ locale });
  const description = translate(SiteCopyKey.MetaDescription, { ...pricingValuesOf({ locale }), agents: leadingAgentNames() });
  const pages: LinkEntry[] = [
    {
      title: translate(SiteCopyKey.MetaTitle),
      url: `${origin}${markdownPathOf({ htmlPath: localePathOf({ locale }) })}`,
      description,
    },
    ...LEGAL_PAGES.filter((page) => page.locale === locale).map((page) => {
      const legal = legalTextOf(page);
      return { title: legal.title, url: `${origin}${markdownPathOf({ htmlPath: legalPathOf(page) })}`, description: legal.description };
    }),
  ];
  const interfaces = INTERFACES.map((entry) => ({ title: entry.title, url: `${origin}${entry.path}`, description: entry.description }));
  const docs = DOCS_LINKS.map((entry) => ({ title: entry.title, url: `${DOCS_ORIGIN}${entry.path}`, description: entry.description }));
  const otherLanguages = Object.values(WebLocale).flatMap((candidate) =>
    Object.values(LlmsFile).map((file) => ({
      title: `${languageOf({ locale: candidate })} ${file}`,
      url: `${origin}${llmsPathOf({ locale: candidate, file })}`,
      description: languageOf({ locale: candidate }),
    })),
  );
  return renderMarkdown({
    blocks: [
      { kind: MarkdownBlockKind.Heading, level: PAGE_LEVEL, text: translate(SiteCopyKey.BrandName) },
      { kind: MarkdownBlockKind.Quote, text: description },
      ...section({ title: PAGES_HEADING, entries: pages }),
      ...section({ title: INTERFACES_HEADING, entries: interfaces }),
      ...section({ title: DOCS_HEADING, entries: docs }),
      ...section({ title: OPTIONAL_HEADING, entries: otherLanguages }),
    ],
  });
}

export function llmsFullTextOf(input: { origin: string; locale: WebLocale }): string {
  const { origin, locale } = input;
  const legalPages = LEGAL_PAGES.filter((page) => page.locale === locale).map((page) => legalMarkdownOf(page));
  return [homeMarkdownOf({ locale, origin }), ...legalPages].join(FULL_SEPARATOR);
}
