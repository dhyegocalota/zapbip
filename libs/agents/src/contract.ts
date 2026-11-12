import type { InstallSection } from '@zapbip/core';
import type { DocsLanguage, OwnerLocale, WakeMode, WakeRung } from '@zapbip/types';

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
    matrixName: Record<DocsLanguage, string>;
    linkName: Record<DocsLanguage, string>;
    pageFacts: Record<DocsLanguage, string[]>;
    speakerNames: string[];
  };
  listen: { rung: WakeRung; expectedDelaySeconds: number | null; setWakeModes: WakeMode[] };
};

export type QuickStartInput = { locale: OwnerLocale; connectionLink: string };
export type QuickStart = { hint: string; code: string; proof: string };

export type AgentInstall = {
  productName: string;
  productDescription: string;
  hasOfficialLogo: boolean;
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
  Install = 'install.ts',
  Connector = 'connector.ts',
  Plugin = 'plugin.ts',
  OwnerRunInstall = 'install-e2e.sh',
}
