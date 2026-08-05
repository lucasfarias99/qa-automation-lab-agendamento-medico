import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { purgeAppointments, purgePatients } from '../controllers/test-data.controller';

export const testDataRouter = Router();

testDataRouter.use(requireAuth);
testDataRouter.delete('/appointments', purgeAppointments);
testDataRouter.delete('/patients', purgePatients);
