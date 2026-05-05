const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { port } = require('./config');
const db = require('./db');

const issuerRoutes = require('./routes/issuer');
const candidateRoutes = require('./routes/candidate');
const verifyRoutes = require('./routes/verify');

async function main() {
  await db.connect();
  const app = express();
  app.use(cors());
  app.use(morgan('dev'));
  app.use(express.json());

  app.use('/issuer', issuerRoutes);
  app.use('/candidate', candidateRoutes);
  app.use('/verify', verifyRoutes);

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  app.listen(port, () => console.log(`Backend listening on ${port}`));
}

main().catch(err => {
  console.error('Failed to start backend', err);
  process.exit(1);
});
