// Node refuses to type-strip `.ts` files inside node_modules
// (ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING). Monogram is a github dependency authored in
// TypeScript, so register an in-thread load hook that strips those files ourselves — only `.ts`
// under node_modules; everything else falls through to Node's default loader. Used by
// `gen:grammar` via `node --import`. (Strip-only, like Node's own loader: Monogram uses erasable
// syntax, since it runs under bare `node` in its own repo.)
import { readFileSync } from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';

registerHooks({
	load(url, context, nextLoad) {
		if (url.endsWith('.ts') && url.includes('/node_modules/')) {
			const source = readFileSync(fileURLToPath(url), 'utf8');
			return {
				format: 'module',
				source: stripTypeScriptTypes(source, { mode: 'strip', sourceUrl: url }),
				shortCircuit: true,
			};
		}
		return nextLoad(url, context);
	},
});
