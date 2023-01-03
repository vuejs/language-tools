let modulePath = './dist/node/server';
try { modulePath = require.resolve('@volar/pug-language-server/bin/pug-language-server'); } catch { }
module.exports = require(modulePath);
