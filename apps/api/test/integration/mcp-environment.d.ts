import type { Bindings } from '../../src/contract/env';

declare global {
  namespace Cloudflare {
    interface Env extends Bindings {}
    interface GlobalProps {
      mainModule: typeof import('../../src/index.dev');
    }
  }
}
