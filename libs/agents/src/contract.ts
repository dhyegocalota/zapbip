import type { InstallSection } from '@zapbip/core';
import { DocsPageLanguage, type OwnerLocale, type WakeMode, type WakeRung } from '@zapbip/types';

export type SessionLookupInput = { workingDirectory: string; homeDirectory: string };
export type WakeIsolationInput = {
  connectionLink: string;
  workingDirectory: string;
  homeDirectory: string;
  systemConfigDirectory?: string;
};
export type WakeIsolation = { isolationArguments: string[]; cleanup: () => Promise<void> };

export type AgentDefinition = {
  enumMember: string;
  idIsOrdinaryWord: boolean;
  docs: {
    matrixName: Record<DocsPageLanguage, string>;
    linkName: Record<DocsPageLanguage, string>;
    pageFacts: Record<DocsPageLanguage, string[]>;
    speakerNames: string[];
  };
  listen: { rung: WakeRung; expectedDelaySeconds: number | null; setWakeModes: WakeMode[] };
};

export type QuickStartInput = { locale: OwnerLocale; connectionLink: string };
export type QuickStart = { hint: string; path: string[]; code: string };

export type AgentInstall = {
  productName: string;
  productDescription: string;
  officialLogo: string | null;
  quickStart: (input: QuickStartInput) => QuickStart;
  render: InstallSection;
};

export enum StrictMcpNullReason {
  DisablesOtherServers = 'disables-other-servers',
}

export type AgentConnectorRuntime = {
  binaryName: string;
  homeFolder: string;
  homeVariable: string;
  strictMcpArgument: string | null;
  strictMcpNullReason: StrictMcpNullReason | null;
  findNewestSessionId: (input: SessionLookupInput) => Promise<string | null>;
  resumeArguments: (input: { sessionId: string; isolationArguments: string[] }) => string[];
  newSessionArguments: ((input: { isolationArguments: string[] }) => string[]) | null;
  prepareIsolation: (input: WakeIsolationInput) => Promise<WakeIsolation>;
  isNewSessionFallback: (input: { stderrText: string }) => boolean;
};

export enum PluginRegistry {
  Npm = 'npm',
  SelfHostedWheel = 'self-hosted-wheel',
}

export type HostedArtifact = {
  label: string;
  filename: string;
  path: string;
  contentType: string;
  expectedSha256: string;
  releaseFolder: string;
  embeddedInInstallCommand: boolean;
};

export type PluginWorkflow = { name: string; filter: string; pythonRequirements: string | null };

export type AgentPlugin = {
  packageFolder: string;
  packageName: string;
  registry: PluginRegistry;
  version: string;
  installCommand: string;
  hostedArtifacts: HostedArtifact[];
  workflow: PluginWorkflow;
  buildRequirements: string | null;
  versionPins: { path: string; pattern: RegExp }[];
  endToEndModule: string;
};

export enum AgentFacet {
  Definition = 'definition.ts',
  EnglishPage = 'page.en.mdx',
  PortuguesePage = 'page.pt-br.mdx',
  SpanishPage = 'page.es.mdx',
  GermanPage = 'page.de.mdx',
  FrenchPage = 'page.fr.mdx',
  JapanesePage = 'page.ja.mdx',
  KoreanPage = 'page.ko.mdx',
  ChinesePage = 'page.zh.mdx',
  Install = 'install.ts',
  Connector = 'connector.ts',
  Plugin = 'plugin.ts',
  OwnerRunInstall = 'install-e2e.sh',
}

export const PAGE_FACETS: Record<DocsPageLanguage, AgentFacet> = {
  [DocsPageLanguage.English]: AgentFacet.EnglishPage,
  [DocsPageLanguage.PortugueseBrazil]: AgentFacet.PortuguesePage,
  [DocsPageLanguage.Spanish]: AgentFacet.SpanishPage,
  [DocsPageLanguage.German]: AgentFacet.GermanPage,
  [DocsPageLanguage.French]: AgentFacet.FrenchPage,
  [DocsPageLanguage.Japanese]: AgentFacet.JapanesePage,
  [DocsPageLanguage.Korean]: AgentFacet.KoreanPage,
  [DocsPageLanguage.Chinese]: AgentFacet.ChinesePage,
};
