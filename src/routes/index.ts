import { Router } from 'express';

import clientRoutes from '../modules/client/client.routes';
import planRoutes from '../modules/plan/plan.routes';
import subscriptionRoutes from '../modules/subscription/subscription.routes';

const routes = Router();

routes.use('/clients', clientRoutes);
routes.use('/plans', planRoutes);
routes.use('/subscriptions', subscriptionRoutes);

export default routes;