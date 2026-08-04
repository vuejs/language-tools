import * as decorateProgramLib from '@volar/typescript/lib/node/decorateProgram';
import { fillSourceFileText } from '@volar/typescript/lib/node/transform';
import { runTsc } from '@volar/typescript/lib/quickstart/runTsc';
import * as core from '@vue/language-core';
import * as path from 'node:path';
import type * as ts from 'typescript';

const windowsPathRE = /\\/g;

export function run(tscPath?: string) {
	let runExtensions = ['.vue'];
	let extensionsChangedException: Error | undefined;

	enableSfcParseErrorReporting();

	const main = () =>
		runTsc(
			resolveTscPath(tscPath),
			runExtensions,
			(ts, options) => {
				const { configFilePath } = options.options;
				const vueOptions = typeof configFilePath === 'string'
					? core.createParsedCommandLine(ts, ts.sys, configFilePath.replace(windowsPathRE, '/')).vueOptions
					: core.createParsedCommandLineByJson(ts, ts.sys, (options.host ?? ts.sys).getCurrentDirectory(), {})
						.vueOptions;
				const allExtensions = core.getAllExtensions(vueOptions);
				if (
					runExtensions.length === allExtensions.length
					&& runExtensions.every(ext => allExtensions.includes(ext))
				) {
					const vueLanguagePlugin = core.createVueLanguagePlugin<string>(
						ts,
						options.options,
						vueOptions,
						id => id,
					);
					return { languagePlugins: [vueLanguagePlugin] };
				}
				else {
					runExtensions = allExtensions;
					throw extensionsChangedException = new Error('extensions changed');
				}
			},
		);

	try {
		return main();
	}
	catch (err) {
		if (err === extensionsChangedException) {
			return main();
		}
		else {
			throw err;
		}
	}
}

function enableSfcParseErrorReporting() {
	const decorateProgram = decorateProgramLib.decorateProgram;
	(decorateProgramLib as { decorateProgram: typeof decorateProgram }).decorateProgram = (language, program) => {
		decorateProgram(language, program);
		const getSyntacticDiagnostics = program.getSyntacticDiagnostics;
		program.getSyntacticDiagnostics = (sourceFile, cancellationToken) => [
			...getSyntacticDiagnostics(sourceFile, cancellationToken),
			...(sourceFile ? [sourceFile] : program.getSourceFiles())
				.flatMap(file => getSfcParseErrors(language, file)),
		];
	};
}

function getSfcParseErrors(language: core.Language<string>, file: ts.SourceFile): ts.DiagnosticWithLocation[] {
	const sourceScript = language.scripts.get(file.fileName);
	const root = sourceScript?.generated?.root;
	if (
		!sourceScript
		|| !(root instanceof core.VueVirtualCode)
		// markdown error locations don't map back to the source
		|| root.languageId !== 'vue'
		|| !root.vueSfc?.errors.length
	) {
		return [];
	}

	// fill in the source text so `--pretty` code frames can render it
	fillSourceFileText(language, file);

	// clamp EOF error offsets to the last source character so they never point into the generated code
	const bound = Math.max(sourceScript.snapshot.getLength() - 1, 0);
	const result: ts.DiagnosticWithLocation[] = [];
	for (const error of root.vueSfc.errors) {
		if (!('code' in error)) {
			continue;
		}
		const start = Math.min(error.loc?.start.offset ?? 0, bound);
		const end = Math.min(error.loc?.end.offset ?? start, bound);
		result.push({
			file,
			start,
			length: end - start,
			category: 1 satisfies ts.DiagnosticCategory.Error,
			code: typeof error.code === 'number' ? error.code : 0,
			messageText: error.message,
		});
	}
	return result;
}

function resolveTscPath(tscPath = require.resolve('typescript/lib/tsc')) {
	try {
		const { name } = require(path.join(tscPath, '..', '..', 'package.json'));
		if (name === '@typescript/typescript6') {
			// `typescript` may be aliased to `@typescript/typescript6`,
			// which keeps tsc in its full TypeScript 6 dependency (`@typescript/old`)
			return require.resolve('@typescript/old/lib/tsc', { paths: [path.dirname(tscPath)] });
		}
	}
	catch {}
	return tscPath;
}
