import type { ConnectionRegistry, InstallCodeDirectory } from '@zapbip/core';
import type { WakeMode } from '@zapbip/types';
import { Hono } from 'hono';

export type WakeModeEntry = { agent: string; wakeMode: WakeMode };

export type RateLimiter = {
  limit(input: { key: string }): Promise<{ success: boolean }>;
};

export type InstallPageRouteDependencies = {
  installCodeDirectory: InstallCodeDirectory;
  connectionRegistry: ConnectionRegistry;
  readWakeModes: (input: { accountId: string }) => Promise<WakeModeEntry[]>;
  limiter: RateLimiter;
};

export function createInstallPageRoute(input: InstallPageRouteDependencies): Hono {
  void input;
  throw new Error('createInstallPageRoute is not implemented');
}
