let modulePath = './dist/node/server';
try { modulePath = require.resolve('@volar/vue-language-server/bin/vue-language-server'); } catch { }
module.exports = require(modulePath);
