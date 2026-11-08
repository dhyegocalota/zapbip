import { createHash } from 'node:crypto';

const HASH_ALGORITHM = 'sha256';
const HASH_ENCODING = 'base64';

export const START_LINK_STYLE = [
  ':root{color-scheme:light dark;--color-page:#f6f8f5;--color-surface:#fff;--color-text:#0e1f1a;--color-text-muted:#4b5e57;--color-border:#dce5e0;--color-signal:#25d366;--radius-card:1.25rem;--radius-tail:.375rem}',
  '@media (prefers-color-scheme: dark){:root{--color-page:#07120f;--color-surface:#15261f;--color-text:#e8f1ed;--color-text-muted:#9db2aa;--color-border:#1f332d}}',
  'body{margin:0;min-height:100vh;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;padding:1.5rem;background:var(--color-page) radial-gradient(64rem 28rem at 50% -12rem,rgb(37 211 102/.22),transparent 70%) no-repeat;color:var(--color-text);font:1rem/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}',
  'section{box-sizing:border-box;width:100%;max-width:32rem;padding:1.5rem;background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-tail) var(--radius-card) var(--radius-card) var(--radius-card);box-shadow:0 1px 2px rgb(14 31 26/.05),0 8px 24px -12px rgb(14 31 26/.12)}',
  'section:first-of-type{border-top:.25rem solid var(--color-signal)}',
  'section+section{color:var(--color-text-muted)}',
  'h1{margin:0 0 .75rem;font:700 clamp(1.5rem,1.2rem + 1.4vw,2rem)/1.1 ui-rounded,"SF Pro Rounded",system-ui,sans-serif;letter-spacing:-.025em}',
  'section+section h1{font-size:1.125rem;color:var(--color-text)}',
  'p{margin:0}',
].join('');

export const START_LINK_STYLE_HASH = `${HASH_ALGORITHM}-${createHash(HASH_ALGORITHM).update(START_LINK_STYLE).digest(HASH_ENCODING)}`;
