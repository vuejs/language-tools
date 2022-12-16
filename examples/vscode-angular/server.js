let modulePath = './dist/node/server';
try { modulePath = require.resolve('@volar/angular-language-server/bin/angular-language-server'); } catch { }
module.exports = require(modulePath);
