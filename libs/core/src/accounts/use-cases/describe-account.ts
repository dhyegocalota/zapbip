import type { AccountOverview } from '../account-overview';
import type { DescribeAccountInput } from './types';

export async function describeAccount(input: DescribeAccountInput): Promise<AccountOverview> {
  throw new Error('describeAccount is not implemented');
}
