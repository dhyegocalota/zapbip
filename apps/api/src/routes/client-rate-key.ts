const IPV6_SEPARATOR = ':';
const IPV6_COMPRESSION = '::';
const IPV6_GROUP_COUNT = 8;
const IPV6_PREFIX_GROUPS = 4;
const HEXADECIMAL_RADIX = 16;
const IPV4_MAPPED_PREFIX = '::ffff:';
const IPV4_SEPARATOR = '.';
const IPV4_MAPPED_HEXADECIMAL_PATTERN = /^[0-9a-f]{1,4}:[0-9a-f]{1,4}$/i;
const BYTE_BITS = 8;
const BYTE_MASK = 0xff;

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

function mappedIpv4Of(input: { address: string }): string | null {
  const lowered = input.address.toLowerCase();
  if (!lowered.startsWith(IPV4_MAPPED_PREFIX)) return null;
  const mapped = lowered.slice(IPV4_MAPPED_PREFIX.length);
  if (mapped.includes(IPV4_SEPARATOR)) return mapped;
  if (!IPV4_MAPPED_HEXADECIMAL_PATTERN.test(mapped)) return null;
  const [high, low] = mapped.split(IPV6_SEPARATOR).map((group) => parseInt(group, HEXADECIMAL_RADIX));
  const value = high! * (BYTE_MASK + 1) ** 2 + low!;
  return [value >>> (BYTE_BITS * 3), value >>> (BYTE_BITS * 2), value >>> BYTE_BITS, value]
    .map((part) => part & BYTE_MASK)
    .join(IPV4_SEPARATOR);
}

export function clientRateKey(input: { address: string }): string {
  if (!input.address.includes(IPV6_SEPARATOR)) return input.address;
  const mappedIpv4 = mappedIpv4Of({ address: input.address });
  if (mappedIpv4 !== null) return mappedIpv4;
  const prefixGroups = expandGroups(input).slice(0, IPV6_PREFIX_GROUPS);
  return prefixGroups.map((group) => parseInt(group, HEXADECIMAL_RADIX).toString(HEXADECIMAL_RADIX)).join(IPV6_SEPARATOR);
}
