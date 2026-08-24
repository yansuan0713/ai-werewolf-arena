import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

const port = Number(process.env.PORT || 3001);
const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(here, '..', '..', 'dist');

createApp(undefined, dist).listen(port, '127.0.0.1', () =>
  console.log(`AI Werewolf Arena: http://127.0.0.1:${port}`),
);
