require('dotenv').config();

const createApp = require('./app');
const { initSchema } = require('./db');

const PORT = process.env.PORT || 8080;

async function main() {
  await initSchema();

  const app = createApp();
  app.listen(PORT, () => {
    console.log(`project-tracker listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start project-tracker', err);
  process.exit(1);
});
