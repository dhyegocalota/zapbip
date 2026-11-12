import { BackofficePath } from './backoffice-paths';

const QUERY_OR_FRAGMENT_PATTERN = /[?#][\s\S]*$/;
const EXACT_PAGES: string[] = [
  BackofficePath.Home,
  BackofficePath.SignIn,
  BackofficePath.SignInCode,
  BackofficePath.Numbers,
  BackofficePath.Metrics,
  BackofficePath.Audit,
];
const NUMBERS_SUBPAGE_PATTERN = new RegExp(`^${BackofficePath.Numbers}(?:/[\\w-]+)+$`);

export function returnTargetOf(input: { returnTo: string | null }): string {
  const { returnTo } = input;
  if (returnTo === null) return BackofficePath.Home;
  const path = returnTo.replace(QUERY_OR_FRAGMENT_PATTERN, '');
  const isBackofficePage = EXACT_PAGES.includes(path) || NUMBERS_SUBPAGE_PATTERN.test(path);
  return isBackofficePage ? path : BackofficePath.Home;
}
