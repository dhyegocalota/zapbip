import { OwnerLocale } from '@zapbip/types';
import type { Child, FC } from 'hono/jsx';

const FLAG_VIEWBOX = '0 0 20 14';
const FLAG_WIDTH = 20;
const FLAG_HEIGHT = 14;
const UNITED_STATES_STRIPE_OFFSETS = [0, 4, 8, 12];
const STRIPE_HEIGHT = 2;
const CANTON_WIDTH = 9;
const CANTON_HEIGHT = 8;
const BRAZIL_DIAMOND = '10,1.5 18.5,7 10,12.5 1.5,7';
const BRAZIL_DISC_RADIUS = 3.2;
const SPAIN_BAND_OFFSET = 3.5;
const SPAIN_BAND_HEIGHT = 7;
const GERMANY_STRIPE_HEIGHT = FLAG_HEIGHT / 3;
const FRANCE_STRIPE_WIDTH = FLAG_WIDTH / 3;
const JAPAN_DISC_RADIUS = 4.2;
const KOREA_DISC_RADIUS = 3.5;
const KOREA_UPPER_HALF = 'M6.5 7a3.5 3.5 0 0 1 7 0z';
const KOREA_LOWER_HALF = 'M6.5 7a3.5 3.5 0 0 0 7 0z';
const KOREA_TRIGRAM_OFFSETS = [
  { x: 1.6, y: 1.4 },
  { x: 15.4, y: 1.4 },
  { x: 1.6, y: 11.2 },
  { x: 15.4, y: 11.2 },
];
const KOREA_TRIGRAM_WIDTH = 3;
const KOREA_TRIGRAM_HEIGHT = 1.4;
const CHINA_STAR = '4.00,1.20 4.65,3.11 6.66,3.13 5.05,4.34 5.65,6.27 4.00,5.10 2.35,6.27 2.95,4.34 1.34,3.13 3.35,3.11';

const ARABIC_MOON_CENTER = { x: 9, y: 7 };
const ARABIC_MOON_RADIUS = 4.2;
const ARABIC_BITE_CENTER = { x: 10.6 };
const ARABIC_BITE_RADIUS = 3.5;

type FlagFrameProps = { name: string; children: Child };

function FlagFrame(props: FlagFrameProps) {
  return (
    <svg class="flag" data-flag={props.name} viewBox={FLAG_VIEWBOX} width={FLAG_WIDTH} height={FLAG_HEIGHT} aria-hidden="true">
      {props.children}
    </svg>
  );
}

function UnitedStatesFlag() {
  return (
    <FlagFrame name="us">
      <rect width={FLAG_WIDTH} height={FLAG_HEIGHT} fill="#ffffff" />
      {UNITED_STATES_STRIPE_OFFSETS.map((offset) => (
        <rect y={offset} width={FLAG_WIDTH} height={STRIPE_HEIGHT} fill="#b22234" />
      ))}
      <rect width={CANTON_WIDTH} height={CANTON_HEIGHT} fill="#3c3b6e" />
    </FlagFrame>
  );
}

function BrazilFlag() {
  return (
    <FlagFrame name="br">
      <rect width={FLAG_WIDTH} height={FLAG_HEIGHT} fill="#009b3a" />
      <polygon points={BRAZIL_DIAMOND} fill="#fedf00" />
      <circle cx="10" cy="7" r={BRAZIL_DISC_RADIUS} fill="#002776" />
    </FlagFrame>
  );
}

function SpainFlag() {
  return (
    <FlagFrame name="es">
      <rect width={FLAG_WIDTH} height={FLAG_HEIGHT} fill="#aa151b" />
      <rect y={SPAIN_BAND_OFFSET} width={FLAG_WIDTH} height={SPAIN_BAND_HEIGHT} fill="#f1bf00" />
    </FlagFrame>
  );
}

function GermanyFlag() {
  return (
    <FlagFrame name="de">
      <rect width={FLAG_WIDTH} height={GERMANY_STRIPE_HEIGHT} fill="#000000" />
      <rect y={GERMANY_STRIPE_HEIGHT} width={FLAG_WIDTH} height={GERMANY_STRIPE_HEIGHT} fill="#dd0000" />
      <rect y={GERMANY_STRIPE_HEIGHT * 2} width={FLAG_WIDTH} height={GERMANY_STRIPE_HEIGHT} fill="#ffce00" />
    </FlagFrame>
  );
}

function FranceFlag() {
  return (
    <FlagFrame name="fr">
      <rect width={FRANCE_STRIPE_WIDTH} height={FLAG_HEIGHT} fill="#0055a4" />
      <rect x={FRANCE_STRIPE_WIDTH} width={FRANCE_STRIPE_WIDTH} height={FLAG_HEIGHT} fill="#ffffff" />
      <rect x={FRANCE_STRIPE_WIDTH * 2} width={FRANCE_STRIPE_WIDTH} height={FLAG_HEIGHT} fill="#ef4135" />
    </FlagFrame>
  );
}

function JapanFlag() {
  return (
    <FlagFrame name="jp">
      <rect width={FLAG_WIDTH} height={FLAG_HEIGHT} fill="#ffffff" />
      <circle cx="10" cy="7" r={JAPAN_DISC_RADIUS} fill="#bc002d" />
    </FlagFrame>
  );
}

function KoreaFlag() {
  return (
    <FlagFrame name="kr">
      <rect width={FLAG_WIDTH} height={FLAG_HEIGHT} fill="#ffffff" />
      <circle cx="10" cy="7" r={KOREA_DISC_RADIUS} fill="#0047a0" />
      <path d={KOREA_UPPER_HALF} fill="#cd2e3a" />
      <path d={KOREA_LOWER_HALF} fill="#0047a0" />
      {KOREA_TRIGRAM_OFFSETS.map((offset) => (
        <rect x={offset.x} y={offset.y} width={KOREA_TRIGRAM_WIDTH} height={KOREA_TRIGRAM_HEIGHT} fill="#000000" />
      ))}
    </FlagFrame>
  );
}

function ChinaFlag() {
  return (
    <FlagFrame name="cn">
      <rect width={FLAG_WIDTH} height={FLAG_HEIGHT} fill="#de2910" />
      <polygon points={CHINA_STAR} fill="#ffde00" />
    </FlagFrame>
  );
}

function ArabicFlag() {
  return (
    <FlagFrame name="ar">
      <rect width={FLAG_WIDTH} height={FLAG_HEIGHT} fill="#007a3d" />
      <circle cx={ARABIC_MOON_CENTER.x} cy={ARABIC_MOON_CENTER.y} r={ARABIC_MOON_RADIUS} fill="#ffffff" />
      <circle cx={ARABIC_BITE_CENTER.x} cy={ARABIC_MOON_CENTER.y} r={ARABIC_BITE_RADIUS} fill="#007a3d" />
    </FlagFrame>
  );
}

const FLAGS: Record<OwnerLocale, FC> = {
  [OwnerLocale.EnglishUs]: UnitedStatesFlag,
  [OwnerLocale.PortugueseBrazil]: BrazilFlag,
  [OwnerLocale.Spanish]: SpainFlag,
  [OwnerLocale.German]: GermanyFlag,
  [OwnerLocale.French]: FranceFlag,
  [OwnerLocale.Japanese]: JapanFlag,
  [OwnerLocale.Korean]: KoreaFlag,
  [OwnerLocale.ChineseSimplified]: ChinaFlag,
  [OwnerLocale.Arabic]: ArabicFlag,
};

export function Flag(props: { locale: OwnerLocale }) {
  const FlagOfLocale = FLAGS[props.locale];
  return <FlagOfLocale />;
}
