import { DocsPageLanguage, WakeMode, WakeRung } from '@zapbip/types';
import type { AgentDefinition } from '../../src/contract';
import { perLanguage } from '../../src/docs';

export const definition: AgentDefinition = {
  enumMember: 'AnyMcpClient',
  idIsOrdinaryWord: false,
  docs: {
    matrixName: {
      [DocsPageLanguage.English]: 'Any app with MCP (Model Context Protocol)',
      [DocsPageLanguage.PortugueseBrazil]: 'Qualquer app com MCP (Model Context Protocol)',
      [DocsPageLanguage.Spanish]: 'Cualquier app con MCP (Model Context Protocol)',
      [DocsPageLanguage.German]: 'Jede App mit MCP (Model Context Protocol)',
      [DocsPageLanguage.French]: 'Toute application avec MCP (Model Context Protocol)',
      [DocsPageLanguage.Japanese]: 'MCP（Model Context Protocol）対応のあらゆるアプリ',
      [DocsPageLanguage.Korean]: 'MCP(Model Context Protocol)를 지원하는 모든 앱',
      [DocsPageLanguage.Chinese]: '任何支持 MCP（Model Context Protocol）的应用',
      [DocsPageLanguage.Arabic]: 'أي تطبيق يدعم MCP (Model Context Protocol)',
      [DocsPageLanguage.Hindi]: 'MCP (Model Context Protocol) वाला कोई भी ऐप',
    },
    linkName: {
      [DocsPageLanguage.English]: 'Any MCP app',
      [DocsPageLanguage.PortugueseBrazil]: 'Qualquer app MCP',
      [DocsPageLanguage.Spanish]: 'Cualquier app MCP',
      [DocsPageLanguage.German]: 'Jede MCP-App',
      [DocsPageLanguage.French]: 'Toute application MCP',
      [DocsPageLanguage.Japanese]: '任意の MCP アプリ',
      [DocsPageLanguage.Korean]: '모든 MCP 앱',
      [DocsPageLanguage.Chinese]: '任何 MCP 应用',
      [DocsPageLanguage.Arabic]: 'أي تطبيق MCP',
      [DocsPageLanguage.Hindi]: 'कोई भी MCP ऐप',
    },
    pageFacts: perLanguage({ valueOf: () => ['check_inbox', '/developers/any-mcp-client'] }),
    speakerNames: [],
  },
  listen: {
    rung: WakeRung.Inbox,
    expectedDelaySeconds: null,
    setWakeModes: [],
  },
};
