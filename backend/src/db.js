const mongoose = require('mongoose');
const { mongodbUri } = require('./config');

async function connect() {
  await mongoose.connect(mongodbUri, { useNewUrlParser: true, useUnifiedTopology: true });
}

module.exports = { connect, mongoose };
