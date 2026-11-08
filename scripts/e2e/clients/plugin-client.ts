import type { Container } from './container';

export type PluginClientInput = {
  name: string;
  directory: string;
  connectionLink: string;
  allowedUsers: string;
  hasMcpServer: boolean;
  fakeModelPort: number;
  certificateFile: string;
};

export type PluginEndToEndModule = {
  buildPluginImage: (input: { directory: string }) => Promise<void>;
  startPluginClient: (input: PluginClientInput) => Promise<Container>;
};
