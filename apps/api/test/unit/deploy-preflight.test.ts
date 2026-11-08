import { COMPANY_FACT_UNSET, NPM_REGISTRY_URL, PRODUCTION_PUBLIC_ORIGIN } from '@zapbip/types';
import type { CompanyFacts } from '@zapbip/types';
import { describe, expect, it } from 'vitest';
import { PLACEHOLDER_VALUE_PREFIX } from '../../src/operations/constants';
import { DeployEnvironment } from '../../src/operations/deploy-environment';
import {
  type DeployBlock,
  type EnvironmentVariables,
  PreflightStep,
  type PreflightWarning,
  PreflightWarningKind,
  type WorkerFacts,
  runDocsPreflight,
  runWorkerPreflight,
} from '../../src/operations/deploy-preflight';
import { SmokeInput } from '../../src/operations/smoke-inputs';
import { WorkerSecret } from '../../src/operations/worker-secret';
import {
  blockOf,
  COMPLETE_COMPANY,
  COMPLETE_VARIABLES,
  type FakeNameserverResolver,
  type FakePackageFetcher,
  fakeNameserverResolver,
  type FakeShell,
  fakePackageFetcher,
  fakeShell,
  NPM_PUBLISHER,
  NPM_PUBLISHER_VARIABLE,
  HOSTED_PLUGINS,
  HOSTED_REQUIREMENTS_FILENAME,
  HOSTED_WHEEL_FILENAME,
  NPM_VERSION,
  HOSTED_PLUGIN_VERSION,
  HOSTED_REQUIREMENTS_SHA256,
  HOSTED_REQUIREMENTS_URL,
  HOSTED_WHEEL_SHA256,
  HOSTED_WHEEL_URL,
  OTHER_WHEEL_SHA256,
  READY_WORKER_FACTS,
} from './fake-deploy-shell';
import { SAMPLE_NPM_PACKAGE_NAME } from '../support/hosted-plugin-sample';

function workerInput(input: {
  environment?: DeployEnvironment;
  shell?: FakeShell;
  block?: DeployBlock;
  isInteractive?: boolean;
  firstDeploy?: boolean;
  environmentVariables?: EnvironmentVariables;
  company?: CompanyFacts;
  npmVersion?: string;
  packageFetcher?: FakePackageFetcher;
  nameserverResolver?: FakeNameserverResolver;
  workerFacts?: WorkerFacts;
  warnings?: PreflightWarning[];
}) {
