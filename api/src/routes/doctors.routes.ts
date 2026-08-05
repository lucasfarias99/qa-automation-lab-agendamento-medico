import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import { listDoctors, getDoctor, getDoctorSlots } from '../controllers/doctors.controller';

export const doctorsRouter = Router();

doctorsRouter.use(requireAuth);
doctorsRouter.get('/', listDoctors);
doctorsRouter.get('/:id/slots', getDoctorSlots);
doctorsRouter.get('/:id', getDoctor);
