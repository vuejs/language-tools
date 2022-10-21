let modulePath = './dist/node/client';
try { modulePath = require.resolve('./out/nodeClientMain'); } catch { }
module.exports = require(modulePath);
