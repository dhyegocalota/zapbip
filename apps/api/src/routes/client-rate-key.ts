const IPV6_SEPARATOR = ':';
const IPV6_COMPRESSION = '::';
const IPV6_GROUP_COUNT = 8;
const IPV6_PREFIX_GROUPS = 4;
const HEXADECIMAL_RADIX = 16;

function expandGroups(input: { address: string }): string[] {
  const [head, tail] = input.address.split(IPV6_COMPRESSION);
  const headGroups = head === '' ? [] : head.split(IPV6_SEPARATOR);
  if (tail === undefined) return headGroups;
  const tailGroups = tail === '' ? [] : tail.split(IPV6_SEPARATOR);
  const fill = Array<string>(IPV6_GROUP_COUNT - headGroups.length - tailGroups.length).fill('0');
  return [...headGroups, ...fill, ...tailGroups];
}

export function clientRateKey(input: { address: string }): string {
  if (!input.address.includes(IPV6_SEPARATOR)) return input.address;
  const prefixGroups = expandGroups(input).slice(0, IPV6_PREFIX_GROUPS);
  return prefixGroups.map((group) => parseInt(group, HEXADECIMAL_RADIX).toString(HEXADECIMAL_RADIX)).join(IPV6_SEPARATOR);
}
