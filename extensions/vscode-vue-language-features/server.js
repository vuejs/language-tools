try {
	module.exports = require('@volar/vue-language-server/bin/vue-language-server');
}
catch {
	module.exports = require('./dist/node/server');
}
