let modulePath = './dist/server';
try { modulePath = require.resolve('@volar/vue-language-server/bin/vue-language-server'); } catch { }
module.exports = require(modulePath);
