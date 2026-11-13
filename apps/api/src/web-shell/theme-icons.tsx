import type { Child } from 'hono/jsx';
import { ShellTheme } from './shell-theme';

const ICON_VIEWBOX = '0 0 24 24';
const ICON_SIZE = 14;
const ICON_STROKE_WIDTH = 2;
const SUN_RAYS = [
  'M12 2v2',
  'M12 20v2',
  'M4.9 4.9l1.4 1.4',
  'M17.7 17.7l1.4 1.4',
  'M2 12h2',
  'M20 12h2',
  'M4.9 19.1l1.4-1.4',
  'M17.7 6.3l1.4-1.4',
];
const MOON_PATH = 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z';

function SunShape() {
  return (
    <>
      <circle cx="12" cy="12" r="4" />
      {SUN_RAYS.map((ray) => (
        <path d={ray} />
      ))}
    </>
  );
}

function MoonShape() {
  return <path d={MOON_PATH} />;
}

function SystemShape() {
  return (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8" />
      <path d="M12 16v4" />
    </>
  );
}

const SHAPES: Record<ShellTheme, () => Child> = {
  [ShellTheme.Light]: SunShape,
  [ShellTheme.Dark]: MoonShape,
  [ShellTheme.System]: SystemShape,
};

export function ThemeIcon(props: { theme: ShellTheme }) {
  return (
    <svg
      class="theme-icon"
      viewBox={ICON_VIEWBOX}
      width={ICON_SIZE}
      height={ICON_SIZE}
      fill="none"
      stroke="currentColor"
      stroke-width={ICON_STROKE_WIDTH}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      {SHAPES[props.theme]()}
    </svg>
  );
}
