let modulePath = './dist/node/client';
try { modulePath = require.resolve('./out/client'); } catch { }
module.exports = require(modulePath);
