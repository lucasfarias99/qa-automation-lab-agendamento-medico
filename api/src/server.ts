import { createApp } from './app';
import { getDb } from './config/database';

const port = process.env.API_PORT ? Number(process.env.API_PORT) : 3000;

getDb();
const app = createApp();

app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
