import { buildAccountOverview, type AccountOverview } from '../account-overview';
import { loadOwnerAccount } from './load-owner-account';
import type { DescribeAccountInput } from './types';

export async function describeAccount(input: DescribeAccountInput): Promise<AccountOverview> {
  const { dependencies, connection } = input;
  const { accountId } = connection;
  const account = await loadOwnerAccount({ dependencies, accountId });
  const connections = await dependencies.connections.listActive({ accountId });
  const activity = await dependencies.repository.listAgents();
  return buildAccountOverview({ account, connections, activity });
}
