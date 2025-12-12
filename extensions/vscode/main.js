try {
	module.exports = require('./out/extension.js');
}
catch {
	module.exports = require('./dist/extension.js');
}
