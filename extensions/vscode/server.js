try {
	module.exports = require('@vue/language-server/bin/vue-simple-language-server');
} catch {
	module.exports = require('./dist/server');
}
