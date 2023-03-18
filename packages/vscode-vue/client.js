let modulePath = './dist/client';
try { modulePath = require.resolve('./out/nodeClientMain'); } catch { }
module.exports = require(modulePath);
