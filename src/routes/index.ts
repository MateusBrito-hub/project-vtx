import { Router } from 'express';

import clientRoutes from '../modules/client/client.routes';
import planRoutes from '../modules/plan/plan.routes';
import subscriptionRoutes from '../modules/subscription/subscription.routes';
import authRoutes from '../modules/auth/auth.routes'
import { authMiddleware } from '../shared/auth/auth.middleware';

const routes = Router();

routes.use('/auth', authRoutes)

routes.use(authMiddleware)

routes.use('/clients', clientRoutes);
routes.use('/plans', planRoutes);
routes.use('/subscriptions', subscriptionRoutes);

export default routes;