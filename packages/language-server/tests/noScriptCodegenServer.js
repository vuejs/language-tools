// The language server where @vue/content-mapper cannot be resolved, as when it is not installed: it runs without
// a script code generation plugin, as with a Vue Content Mapper other than @vue/content-mapper.
const Module = require('node:module');

const resolveFilename = Module._resolveFilename;
Module._resolveFilename = function(request, ...rest) {
	if (request === '@vue/content-mapper' || request.startsWith('@vue/content-mapper/')) {
		const error = new Error(`Cannot find module '${request}'`);
		error.code = 'MODULE_NOT_FOUND';
		throw error;
	}
	return resolveFilename.call(this, request, ...rest);
};

require('../index.js');
