const IPV6_SEPARATOR = ':';
const IPV6_COMPRESSION = '::';
const IPV6_GROUP_COUNT = 8;
const IPV6_PREFIX_GROUPS = 4;
const HEXADECIMAL_RADIX = 16;

function splitGroups(input: { text: string }): string[] {
  if (input.text === '') return [];
  return input.text.split(IPV6_SEPARATOR);
}

function expandGroups(input: { address: string }): string[] {
  const compressionIndex = input.address.indexOf(IPV6_COMPRESSION);
  if (compressionIndex === -1) return splitGroups({ text: input.address });
  const headGroups = splitGroups({ text: input.address.slice(0, compressionIndex) });
  const tailGroups = splitGroups({ text: input.address.slice(compressionIndex + IPV6_COMPRESSION.length) });
  const fill = Array<string>(IPV6_GROUP_COUNT - headGroups.length - tailGroups.length).fill('0');
  return [...headGroups, ...fill, ...tailGroups];
}

export function clientRateKey(input: { address: string }): string {
  if (!input.address.includes(IPV6_SEPARATOR)) return input.address;
  const prefixGroups = expandGroups(input).slice(0, IPV6_PREFIX_GROUPS);
  return prefixGroups.map((group) => parseInt(group, HEXADECIMAL_RADIX).toString(HEXADECIMAL_RADIX)).join(IPV6_SEPARATOR);
}
