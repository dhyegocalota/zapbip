import { COMPANY } from '@zapbip/types';

const CONTACT_PLACEHOLDER = '{contactEmail}';
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
