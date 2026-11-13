import { OwnerLocale } from '@zapbip/types';

const FLAG_VIEWBOX = '0 0 20 14';
const FLAG_WIDTH = 20;
const FLAG_HEIGHT = 14;
const UNITED_STATES_STRIPE_OFFSETS = [0, 4, 8, 12];
const STRIPE_HEIGHT = 2;
const CANTON_WIDTH = 9;
const CANTON_HEIGHT = 8;
const BRAZIL_DIAMOND = '10,1.5 18.5,7 10,12.5 1.5,7';
const BRAZIL_DISC_RADIUS = 3.2;

function UnitedStatesFlag() {
  return (
    <svg class="flag" data-flag="us" viewBox={FLAG_VIEWBOX} width={FLAG_WIDTH} height={FLAG_HEIGHT} aria-hidden="true">
      <rect width={FLAG_WIDTH} height={FLAG_HEIGHT} fill="#ffffff" />
      {UNITED_STATES_STRIPE_OFFSETS.map((offset) => (
        <rect y={offset} width={FLAG_WIDTH} height={STRIPE_HEIGHT} fill="#b22234" />
      ))}
      <rect width={CANTON_WIDTH} height={CANTON_HEIGHT} fill="#3c3b6e" />
    </svg>
  );
}

function BrazilFlag() {
  return (
    <svg class="flag" data-flag="br" viewBox={FLAG_VIEWBOX} width={FLAG_WIDTH} height={FLAG_HEIGHT} aria-hidden="true">
      <rect width={FLAG_WIDTH} height={FLAG_HEIGHT} fill="#009b3a" />
      <polygon points={BRAZIL_DIAMOND} fill="#fedf00" />
      <circle cx="10" cy="7" r={BRAZIL_DISC_RADIUS} fill="#002776" />
    </svg>
  );
}

export function Flag(props: { locale: OwnerLocale }) {
  return props.locale === OwnerLocale.PortugueseBrazil ? <BrazilFlag /> : <UnitedStatesFlag />;
}
