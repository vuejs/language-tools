try {
	module.exports = require('../typescript-vue-plugin');
}
catch {
	module.exports = require('../../dist');
}
