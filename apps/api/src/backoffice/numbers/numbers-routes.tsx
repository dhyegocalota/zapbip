import { Hono } from 'hono';
import { numberAdminOf } from '../../adapters/d1/d1-number-admin';
import type { BackofficeEnv } from '../backoffice-env';
import { BackofficePath } from '../backoffice-paths';
import { signedInPageContext } from '../page-context';
import { appSecretRoutes } from './routes/app-secret-routes';
import { numberRoutes } from './routes/number-routes';
import { registerRoutes } from './routes/register-routes';
import { NumbersListPage } from './views/numbers-list';

export const numbersRoutes = new Hono<BackofficeEnv>();

numbersRoutes.get(BackofficePath.Numbers, async (context) => {
  const entries = await numberAdminOf({ bindings: context.env }).listNumbers();
  return context.html(<NumbersListPage page={await signedInPageContext({ context })} entries={entries} />);
});

numbersRoutes.route('/', registerRoutes);
numbersRoutes.route('/', numberRoutes);
numbersRoutes.route('/', appSecretRoutes);
