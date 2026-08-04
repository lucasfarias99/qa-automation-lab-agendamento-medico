import { createApp } from './app';

const port = process.env.API_PORT ? Number(process.env.API_PORT) : 3000;
const app = createApp();

app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
