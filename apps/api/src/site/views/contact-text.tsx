import { COMPANY } from '@zapbip/types';
import { CONTACT_PLACEHOLDER } from '../plain-contact-text';

const MAILTO_PREFIX = 'mailto:';

export function ContactText(props: { text: string }) {
  const [before, after] = props.text.split(CONTACT_PLACEHOLDER);
  if (after === undefined) return <>{before}</>;
  return (
    <>
      {before}
      <a href={`${MAILTO_PREFIX}${COMPANY.contactEmail}`}>{COMPANY.contactEmail}</a>
      {after}
    </>
  );
}
