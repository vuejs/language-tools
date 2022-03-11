try {
    module.exports = require('./node_modules/@volar/vue-language-server/out/node');
}
catch {
    module.exports = require('./dist/node/server');
}
