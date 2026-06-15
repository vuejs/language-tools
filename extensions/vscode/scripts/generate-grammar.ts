// Generates the Vue TextMate grammars + the VS Code language configuration from
// `vue.monogram.ts` using the Monogram engine vendored as a git submodule at
// `extensions/vscode/monogram`. The grammar DEFINITION (vue.monogram.ts) is maintained in
// this repo; the engine (gen-tm / gen-vscode-config) and the reused HTML base (html.ts) come
// from the pinned submodule. Bumping the submodule + re-running this keeps us in sync with
// Monogram — see `.github/workflows/sync-grammar.yml`.
//
// Emits the artifacts the extension references in `package.json` (paths relative to the
// extension root):
//   - syntaxes/vue.tmLanguage.json                 (scopeName text.html.vue)
//   - syntaxes/vue.directives.tmLanguage.json      (injection, scopeName vue.directives)
//   - syntaxes/vue.interpolations.tmLanguage.json  (injection, scopeName vue.interpolations)
//   - languages/vue-language-configuration.json    (editor behavior: indent / folding / brackets)
// The generation path has no external dependencies, so no `monogram` install is needed.
import { writeFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { generateMarkupInjection, generateTmLanguage } from '../monogram/src/gen-tm.ts';
import { generateLanguageConfig } from '../monogram/src/gen-vscode-config.ts';
import grammar from '../vue.monogram.ts';

// The grammar declares its own name (`defineGrammar({ name: 'vue' })`) — the single source of
// truth for the output filenames, mirroring Monogram's CLI (`grammar.name`).
const { name } = grammar;

// Path (relative to the extension root) → generated grammar/config object. Injection
// scopeNames (`vue.directives` / `vue.interpolations`) map straight to their filenames.
export function generateArtifacts(): Record<string, unknown> {
	const artifacts: Record<string, unknown> = {
		[`syntaxes/${name}.tmLanguage.json`]: generateTmLanguage(grammar, name),
		[`languages/${name}-language-configuration.json`]: generateLanguageConfig(grammar),
	};
	for (const injection of generateMarkupInjection(grammar, name)) {
		artifacts[`syntaxes/${injection.scopeName}.tmLanguage.json`] = injection;
	}
	return artifacts;
}

// Written 2-space like Monogram's CLI; `dprint fmt` (run by the npm script / workflow)
// normalizes to the repo's tab style — the same pipeline the files already went through.
function writeArtifacts() {
	const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
	for (const [relPath, content] of Object.entries(generateArtifacts())) {
		const outPath = path.join(extensionRoot, relPath);
		writeFileSync(outPath, JSON.stringify(content, null, 2) + '\n');
		console.log(`→ Generated ${relPath}`);
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	writeArtifacts();
}
