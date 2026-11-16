import { ONBOARDING_PIN_LENGTH } from '@zapbip/types';

const RANDOM_RANGE = 2 ** 32;
const PIN_SPACE = 10 ** ONBOARDING_PIN_LENGTH;
const ACCEPTED_LIMIT = RANDOM_RANGE - (RANDOM_RANGE % PIN_SPACE);

function drawUniformly(): number {
  const [sample] = crypto.getRandomValues(new Uint32Array(1));
  if (sample === undefined) throw new Error('the random source returned no value');
  if (sample >= ACCEPTED_LIMIT) return drawUniformly();
  return sample % PIN_SPACE;
}

export function generateTwoStepPin(): string {
  return String(drawUniformly()).padStart(ONBOARDING_PIN_LENGTH, '0');
}
