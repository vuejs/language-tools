try {
    module.exports = require('./node_modules/@volar/alpine-language-server/out/node');
}
catch {
    module.exports = require('./dist/node/server');
}
