import { Router } from 'express';

import clientRoutes from '../modules/client/client.routes';
import planRoutes from '../modules/plan/plan.routes';

const routes = Router();

routes.use('/clients', clientRoutes);
routes.use('/plans', planRoutes);

export default routes;