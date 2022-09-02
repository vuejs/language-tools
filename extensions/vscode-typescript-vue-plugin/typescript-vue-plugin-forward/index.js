try {
	// module.exports = require('../typescript-vue-plugin');
	// pnpm path
	module.exports = require('../../../../../extensions/vscode-typescript-vue-plugin/node_modules/typescript-vue-plugin');
}
catch {
	module.exports = require('../../dist');
}
