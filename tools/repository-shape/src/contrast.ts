const HEX_BASE = 16;
const HEX_CHANNEL_LENGTH = 2;
const CHANNEL_MAXIMUM = 255;
const LINEAR_THRESHOLD = 0.03928;
const HEX_PATTERN = /^#([0-9a-fA-F]{6})$/;
const RGB_PATTERN = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:\s*[/,]\s*([\d.]+))?\s*\)$/;
const TOKEN_BLOCK_PATTERN = /:root[^{]*\{[^}]*\}/g;
const FORCED_DARK_BLOCK_PATTERN = /:root\[data-theme='dark'\]\s*\{[^}]*\}/;
const TOKEN_PATTERN = /(--[a-z0-9-]+):\s*([^;]+);/g;
const TOKEN_BLOCK_COUNTS = [2, 3];

interface Colour {
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

function parseColour({ value }: { value: string }): Colour {
  const hexMatch = value.trim().match(HEX_PATTERN);
  if (hexMatch) {
    const [red, green, blue] = [0, 2, 4].map((offset) => parseInt(hexMatch[1]!.slice(offset, offset + HEX_CHANNEL_LENGTH), HEX_BASE));
    return { red: red!, green: green!, blue: blue!, alpha: 1 };
  }
  const rgbMatch = value.trim().match(RGB_PATTERN);
  if (!rgbMatch) throw new Error(`cannot parse the colour ${value}`);
  const alpha = rgbMatch[4] === undefined ? 1 : Number(rgbMatch[4]);
  return { red: Number(rgbMatch[1]), green: Number(rgbMatch[2]), blue: Number(rgbMatch[3]), alpha };
}

function blend({ colour, backdrop }: { colour: Colour; backdrop: Colour }): Colour {
  const mix = (top: number, bottom: number): number => Math.round(top * colour.alpha + bottom * (1 - colour.alpha));
  return {
    red: mix(colour.red, backdrop.red),
    green: mix(colour.green, backdrop.green),
    blue: mix(colour.blue, backdrop.blue),
    alpha: 1,
  };
}

function channelLuminance({ value }: { value: number }): number {
  const fraction = value / CHANNEL_MAXIMUM;
  return fraction <= LINEAR_THRESHOLD ? fraction / 12.92 : ((fraction + 0.055) / 1.055) ** 2.4;
}

function luminanceOf({ colour }: { colour: Colour }): number {
  return (
    0.2126 * channelLuminance({ value: colour.red }) +
    0.7152 * channelLuminance({ value: colour.green }) +
    0.0722 * channelLuminance({ value: colour.blue })
  );
}

function hexOf({ colour }: { colour: Colour }): string {
  const channels = [colour.red, colour.green, colour.blue].map((channel) => channel.toString(HEX_BASE).padStart(HEX_CHANNEL_LENGTH, '0'));
  return `#${channels.join('')}`;
}

export function compositeOver({ colour, backdrop }: { colour: string; backdrop: string }): string {
  const solidBackdrop = parseColour({ value: backdrop });
  if (solidBackdrop.alpha !== 1) throw new Error(`the backdrop ${backdrop} is not opaque`);
  return hexOf({ colour: blend({ colour: parseColour({ value: colour }), backdrop: solidBackdrop }) });
}

export function contrastOf({ foreground, background }: { foreground: string; background: string }): number {
  const solidForeground = parseColour({ value: compositeOver({ colour: foreground, backdrop: background }) });
  const [lighter, darker] = [luminanceOf({ colour: solidForeground }), luminanceOf({ colour: parseColour({ value: background }) })].sort(
    (left, right) => right - left,
  );
  return (lighter! + 0.05) / (darker! + 0.05);
}

function tokensOf({ block }: { block: string }): Record<string, string> {
  return Object.fromEntries([...block.matchAll(TOKEN_PATTERN)].map((match) => [match[1]!, match[2]!.trim()]));
}

export function themeTokens({ stylesheet }: { stylesheet: string }): { light: Record<string, string>; dark: Record<string, string> } {
  const blocks = stylesheet.match(TOKEN_BLOCK_PATTERN);
  if (blocks === null || !TOKEN_BLOCK_COUNTS.includes(blocks.length))
    throw new Error('the stylesheet needs a light and a dark token block');
  const light = tokensOf({ block: blocks[0]! });
  return { light, dark: { ...light, ...tokensOf({ block: blocks[1]! }) } };
}

export function forcedDarkTokens({ stylesheet }: { stylesheet: string }): Record<string, string> {
  const block = stylesheet.match(FORCED_DARK_BLOCK_PATTERN);
  if (block === null) throw new Error('the stylesheet has no forced dark token block');
  return { ...themeTokens({ stylesheet }).light, ...tokensOf({ block: block[0] }) };
}
