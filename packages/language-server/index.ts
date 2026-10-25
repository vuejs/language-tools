import type { VueLanguagePlugin } from '@vue/language-core';
import { startServer } from './lib/server';

if (process.argv.includes('--version')) {
	console.log(require('./package.json').version);
}
else {
	let ts;
	for (const arg of process.argv) {
		if (arg.startsWith('--tsdk=')) {
			const tsdk = arg.substring('--tsdk='.length);
			const tsPath = require.resolve('./typescript.js', { paths: [tsdk] });
			ts = require(tsPath);
			break;
		}
	}
	ts ??= require('typescript');
	// TypeScript 7's `typescript` package has no classic compiler API
	if (typeof ts.createLanguageService !== 'function') {
		console.error(
			`@vue/language-server needs the API of TypeScript 5 or 6, which the loaded \`typescript\` ${
				ts.version ? `(${ts.version}) ` : ''
			}does not provide. Start the server with --tsdk=<path to the lib directory of a typescript 5 or 6 package>.`,
		);
		process.exit(1);
	}
	const scriptPlugins = loadScriptPlugins();
	startServer(ts, { createPlugins: () => scriptPlugins });
}

/**
 * The vue-tsx plugin of the optional peer dependency @vue/content-mapper, whose script embedded code gives script
 * blocks the TypeScript syntactic features (formatting, JSDoc comment templates, JSX closing tags); none if it
 * is not installed.
 */
function loadScriptPlugins(): VueLanguagePlugin[] {
	try {
		return [require('@vue/content-mapper/lib/vueTsx').default];
	}
	catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND') {
			return [];
		}
		throw error;
	}
}
