import * as fs from 'node:fs';
import * as path from 'node:path';

const isDev = process.argv.includes('--dev');

write(
	'typescript-plugin',
	isDev ? '@vue/typescript-plugin' : '../../dist/typescript-plugin.js',
);
write(
	'reactivity-analysis-plugin',
	isDev ? '../../out/reactivityAnalysisPlugin.js' : '../../dist/reactivity-analysis-plugin.js',
);

function write(name: string, specifier: string) {
	const dir = path.join(import.meta.dirname, `../node_modules/vue-${name}-pack`);
	fs.mkdirSync(dir, { recursive: true });
	fs.writeFileSync(path.join(dir, `index.js`), `module.exports = require('${specifier}');\n`);
}
