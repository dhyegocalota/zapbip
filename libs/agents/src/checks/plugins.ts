import type { AgentPlugin } from '../contract';

export type PluginCheckEntry = { id: string; plugin: AgentPlugin };

export type PluginCheckSources = {
  applicationPluginFolders: string[];
  readFile: (path: string) => Buffer | null;
  servedFilenames: string[];
};

export function pluginViolationsOf(_input: { entries: PluginCheckEntry[]; sources: PluginCheckSources }): string[] {
  throw new Error('pluginViolationsOf is not implemented');
}
