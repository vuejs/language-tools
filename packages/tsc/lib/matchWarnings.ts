import * as core from '@vue/language-core';
import type * as ts from 'typescript';

/** runTsc currently has no after-program hook. Restore its adapter on exit. */
export function withMatchWarnings<T>(run: () => T): T {
	const proxy = require(
		'@volar/typescript/lib/node/proxyCreateProgram',
	) as typeof import('@volar/typescript/lib/node/proxyCreateProgram');
	const originalProxy = proxy.proxyCreateProgram;
	proxy.proxyCreateProgram = (ts, createProgram, plugins) =>
		originalProxy(
			ts,
			new Proxy(createProgram, {
				apply(target, thisArg, args) {
					const options = args[0] as ts.CreateProgramOptions;
					const program = Reflect.apply(target, thisArg, args) as ts.Program & {
						getBindAndCheckDiagnostics: ts.Program['getSemanticDiagnostics'];
					};
					const warned = new WeakSet<ts.SourceFile>();
					function reportWarnings(file?: ts.SourceFile) {
						for (const sourceFile of file ? [file] : program.getSourceFiles()) {
							if (warned.has(sourceFile)) {
								continue;
							}
							warned.add(sourceFile);
							const source = options.host?.readFile(sourceFile.fileName);
							if (!source?.includes('v-match')) {
								continue;
							}
							const warnings = core.getMatchWarnings(ts, program, sourceFile.fileName);
							if (!warnings.length) {
								continue;
							}
							const template = core.parseRawIR(source, {}).rawIr.templates[0];
							if (!template) {
								continue;
							}
							const originalFile = ts.createSourceFile(sourceFile.fileName, source, sourceFile.languageVersion);
							for (const warning of warnings) {
								const position = ts.getLineAndCharacterOfPosition(originalFile, template.innerStart + warning.start);
								ts.sys.write(
									`${sourceFile.fileName}(${position.line + 1},${
										position.character + 1
									}): warning V_MATCH_UNREACHABLE: ${warning.message}${ts.sys.newLine}`,
								);
							}
						}
					}
					// Reuse the current checker; do not create a second TypeScript Program.
					// Warnings are separate from TS errors so --noEmit and --build stay green.
					for (const name of ['getSemanticDiagnostics', 'getBindAndCheckDiagnostics'] as const) {
						const original = program[name].bind(program);
						program[name] = (file, cancellationToken) => {
							reportWarnings(file);
							return original(file, cancellationToken);
						};
					}
					return program;
				},
			}),
			plugins,
		);
	try {
		return run();
	}
	finally {
		proxy.proxyCreateProgram = originalProxy;
	}
}
