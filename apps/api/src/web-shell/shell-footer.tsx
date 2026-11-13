import type { OwnerLocale } from '@zapbip/types';
import type { Child } from 'hono/jsx';
import { ShellCopyKey, renderShellCopy } from './shell-copy';
import { shellFooterLinksOf } from './shell-links';

export function ShellFooter(props: { locale: OwnerLocale; note: string; controls: Child }) {
  const { locale } = props;
  return (
    <footer class="shell-footer">
      <div class="shell-footer-inner">
        <p class="shell-footer-note">{props.note}</p>
        <nav aria-label={renderShellCopy({ key: ShellCopyKey.FooterLinksLabel, locale })}>
          <ul class="shell-footer-links">
            {shellFooterLinksOf({ locale }).map((link) => (
              <li>
                <a href={link.href} rel={link.rel}>
                  {renderShellCopy({ key: link.label, locale })}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div class="shell-footer-controls">{props.controls}</div>
      </div>
    </footer>
  );
}
