import { buildConnectionLink } from '@zapbip/core';
import { COMPANY, OwnerLocale } from '@zapbip/types';
import { pricingValuesOf } from './price-format';
import { leadingAgentNames } from './site-agents';
import { IS_SECURITY_POLICY_PUBLIC, SECURITY_POLICY_URL, SECURITY_TEXT_VALIDITY_MS } from './site-constants';
import { SiteCopyKey } from './site-copy';
import { copyOf } from './site-copy-text';
import { languageOf } from '../web-shell/locale-profiles';
import { DOCS_ORIGIN, SitePath } from './site-paths';

const DOCUMENT_VERSION = '1.0.0';
const AGENT_CARD_PROTOCOL_VERSION = '0.3.0';
const AGENT_CARD_TRANSPORT = 'HTTP+JSON';
const MCP_TRANSPORT = 'http';
const PRODUCT_NAME = 'zapbip';
const CONNECTION_SECRET_TEMPLATE = '{connection_secret}';
const DOCS_MCP_PATH = '/mcp';
const JSON_MODE = 'application/json';
const MARKDOWN_MODE = 'text/markdown';
const LANGUAGE_LIST_SEPARATOR = ', ';
const LANGUAGE_TAG_SEPARATOR = '-';
const CONNECTION_DESCRIPTION = 'The connection link is the secret. It arrives in your WhatsApp chat with zapbip once access opens.';

enum McpAuthentication {
  ConnectionLink = 'connection-link',
  None = 'none',
}

type AgentSkill = { id: string; name: string; description: string; tags: string[]; examples: string[] };

const AGENT_SKILLS: AgentSkill[] = [
  {
    id: 'request_access',
    name: 'Request access',
    description: `Add a person to the zapbip early access list without a captcha: POST ${SitePath.RequestAccess} with a JSON body {"email", "language"}.`,
    tags: ['waitlist', 'access'],
    examples: ['Request zapbip access for maria@example.com'],
  },
  {
    id: 'get_pricing',
    name: 'Get pricing',
    description: `Read the plans, prices and the message definition: GET ${SitePath.Pricing}, optionally with ?language=.`,
    tags: ['pricing'],
    examples: ['How much does zapbip cost?'],
  },
  {
    id: 'get_quick_start',
    name: 'Get quick start',
    description: `Read how to connect one agent to zapbip: GET ${SitePath.QuickStart}?agent=<id>, optionally with &language=.`,
    tags: ['install', 'mcp'],
    examples: ['How do I connect my agent to zapbip?'],
  },
  {
    id: 'setup_zapbip',
    name: 'Set up zapbip',
    description: `Read the steps to connect yourself to zapbip: GET ${SitePath.Setup}, or /<language>/setup.md such as /pt-br/setup.md, as Markdown.`,
    tags: ['install', 'setup'],
    examples: ['Set up zapbip for yourself'],
  },
  {
    id: 'read_docs',
    name: 'Read the docs',
    description: `Read the documentation as Markdown or search it through MCP: ${DOCS_ORIGIN}/llms.txt, ${DOCS_ORIGIN}${DOCS_MCP_PATH}.`,
    tags: ['documentation'],
    examples: ['What can zapbip do?'],
  },
];

function mcpServersOf(input: { publicOrigin: string }): object[] {
  const connectionLink = buildConnectionLink({ publicOrigin: input.publicOrigin, secret: CONNECTION_SECRET_TEMPLATE });
  return [
    {
      name: PRODUCT_NAME,
      url: connectionLink,
      transport: MCP_TRANSPORT,
      authentication: McpAuthentication.ConnectionLink,
      description: CONNECTION_DESCRIPTION,
    },
    { name: 'docs', url: `${DOCS_ORIGIN}${DOCS_MCP_PATH}`, transport: MCP_TRANSPORT, authentication: McpAuthentication.None },
  ];
}

export function mcpDiscoveryOf(input: { publicOrigin: string }): object {
  const servers = mcpServersOf(input);
  return { version: DOCUMENT_VERSION, transport: MCP_TRANSPORT, servers };
}

export function mcpServerCardOf(input: { publicOrigin: string }): object {
  const description = copyOf({ locale: OwnerLocale.EnglishUs })(SiteCopyKey.MetaDescription, {
    ...pricingValuesOf({ locale: OwnerLocale.EnglishUs }),
    agents: leadingAgentNames(),
  });
  return {
    name: PRODUCT_NAME,
    description,
    version: DOCUMENT_VERSION,
    serverInfo: { name: PRODUCT_NAME, version: DOCUMENT_VERSION },
    transport: MCP_TRANSPORT,
    capabilities: { tools: true },
    documentationUrl: DOCS_ORIGIN,
    servers: mcpServersOf(input),
  };
}

export function agentCardOf(input: { origin: string }): object {
  const description = copyOf({ locale: OwnerLocale.EnglishUs })(SiteCopyKey.MetaDescription, {
    ...pricingValuesOf({ locale: OwnerLocale.EnglishUs }),
    agents: leadingAgentNames(),
  });
  return {
    protocolVersion: AGENT_CARD_PROTOCOL_VERSION,
    name: PRODUCT_NAME,
    description,
    url: input.origin,
    preferredTransport: AGENT_CARD_TRANSPORT,
    version: DOCUMENT_VERSION,
    documentationUrl: DOCS_ORIGIN,
    provider: { organization: COMPANY.tradeName, url: COMPANY.website },
    capabilities: { streaming: false, pushNotifications: false },
    defaultInputModes: [JSON_MODE],
    defaultOutputModes: [JSON_MODE, MARKDOWN_MODE],
    skills: AGENT_SKILLS.map((skill) => ({ ...skill, inputModes: [JSON_MODE], outputModes: [JSON_MODE] })),
  };
}

function preferredLanguagesOf(): string {
  const primaryTags = Object.values(OwnerLocale).map((locale) => languageOf({ locale }).split(LANGUAGE_TAG_SEPARATOR)[0]!);
  return [...new Set(primaryTags)].sort().join(LANGUAGE_LIST_SEPARATOR);
}

export function securityTextOf(input: { origin: string; now: number }): string {
  return [
    `Contact: mailto:${COMPANY.contactEmail}`,
    `Expires: ${new Date(input.now + SECURITY_TEXT_VALIDITY_MS).toISOString()}`,
    `Preferred-Languages: ${preferredLanguagesOf()}`,
    ...(IS_SECURITY_POLICY_PUBLIC ? [`Policy: ${SECURITY_POLICY_URL}`] : []),
    `Canonical: ${input.origin}${SitePath.SecurityText}`,
    '',
  ].join('\n');
}
