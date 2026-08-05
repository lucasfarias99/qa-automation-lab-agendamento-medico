import express from 'express';
import { authRouter } from './routes/auth.routes';
import { doctorsRouter } from './routes/doctors.routes';
import { appointmentsRouter } from './routes/appointments.routes';
import { testDataRouter } from './routes/test-data.routes';
import { errorHandler } from './middlewares/error-handler.middleware';

export function createApp() {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'UP', timestamp: new Date().toISOString() });
  });

  app.use('/auth', authRouter);
  app.use('/doctors', doctorsRouter);
  app.use('/appointments', appointmentsRouter);
  app.use('/test-data', testDataRouter);

  app.use(errorHandler);

  return app;
}
