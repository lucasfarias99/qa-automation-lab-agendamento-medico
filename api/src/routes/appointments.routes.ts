import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware';
import {
  createAppointment,
  getAppointment,
  listAppointments,
  cancelAppointment,
  updateAppointmentStatus
} from '../controllers/appointments.controller';

export const appointmentsRouter = Router();

appointmentsRouter.use(requireAuth);
appointmentsRouter.post('/', createAppointment);
appointmentsRouter.get('/', listAppointments);
appointmentsRouter.post('/:id/cancel', cancelAppointment);
appointmentsRouter.patch('/:id/status', updateAppointmentStatus);
appointmentsRouter.get('/:id', getAppointment);
