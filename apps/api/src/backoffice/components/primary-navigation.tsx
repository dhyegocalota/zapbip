import type { WebLocale } from '@zapbip/types';
import { BackofficeCopyKey, renderBackofficeCopy } from '../backoffice-copy';
import { BackofficePath } from '../backoffice-paths';

const NAVIGATION_ITEMS: { path: BackofficePath; label: BackofficeCopyKey }[] = [
  { path: BackofficePath.Home, label: BackofficeCopyKey.NavigationHome },
  { path: BackofficePath.Numbers, label: BackofficeCopyKey.NavigationNumbers },
  { path: BackofficePath.Metrics, label: BackofficeCopyKey.NavigationMetrics },
  { path: BackofficePath.Waitlist, label: BackofficeCopyKey.NavigationWaitlist },
  { path: BackofficePath.Access, label: BackofficeCopyKey.NavigationAccess },
  { path: BackofficePath.AgentKeys, label: BackofficeCopyKey.NavigationAgentKeys },
  { path: BackofficePath.Audit, label: BackofficeCopyKey.NavigationAudit },
];

export function PrimaryNavigation(props: { locale: WebLocale; currentPath: string }) {
  return (
    <nav aria-label={renderBackofficeCopy({ key: BackofficeCopyKey.NavigationLabel, locale: props.locale })}>
      {NAVIGATION_ITEMS.map((item) =>
        item.path === props.currentPath ? (
          <a href={item.path} aria-current="page" class="nav-link">
            {renderBackofficeCopy({ key: item.label, locale: props.locale })}
          </a>
        ) : (
          <a href={item.path} class="nav-link">
            {renderBackofficeCopy({ key: item.label, locale: props.locale })}
          </a>
        ),
      )}
    </nav>
  );
}
