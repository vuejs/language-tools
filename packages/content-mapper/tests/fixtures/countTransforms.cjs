// Preloaded through `NODE_OPTIONS` into the mapper process started by the TypeScript language server; logs
// every transform request it receives to `VUE_CONTENT_MAPPER_TRANSFORM_LOG`.
const fs = require('node:fs');
const path = require('node:path');

const main = process.argv[1] ?? '';
if (path.basename(main) === 'server.js' && path.basename(path.dirname(main)) === 'content-mapper') {
	const { vueContentMapper } = require(path.join(path.dirname(main), 'lib/mapper/vueContentMapper.js'));
	const transform = vueContentMapper.transform;
	vueContentMapper.transform = function(params) {
		fs.appendFileSync(process.env.VUE_CONTENT_MAPPER_TRANSFORM_LOG, params.fileName + '\n');
		return transform.call(this, params);
	};
}
