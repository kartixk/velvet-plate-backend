const serverless = require('serverless-http');
// Require the Express app (no app.listen here)
const app = require('../src/app');

module.exports = serverless(app);
