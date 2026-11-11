import type { Child } from 'hono/jsx';

function IconFrame(props: { children: Child }) {
  return (
    <svg
      class="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {props.children}
    </svg>
  );
}

export function SunIcon() {
  return (
    <IconFrame>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.25M12 19.25v2.25M4.93 4.93l1.6 1.6M17.47 17.47l1.6 1.6M2.5 12h2.25M19.25 12h2.25M4.93 19.07l1.6-1.6M17.47 6.53l1.6-1.6" />
    </IconFrame>
  );
}

export function MoonIcon() {
  return (
    <IconFrame>
      <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z" />
    </IconFrame>
  );
}

export function MonitorIcon() {
  return (
    <IconFrame>
      <rect x="3" y="4" width="18" height="12.5" rx="2.5" />
      <path d="M8.5 20.5h7M12 16.5v4" />
    </IconFrame>
  );
}

export function GlobeIcon() {
  return (
    <IconFrame>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.6 2.4 3.9 5.4 3.9 9s-1.3 6.6-3.9 9c-2.6-2.4-3.9-5.4-3.9-9S9.4 5.4 12 3Z" />
    </IconFrame>
  );
}
