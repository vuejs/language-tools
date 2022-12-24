import type * as ts from 'typescript/lib/tsserverlibrary';
import type * as embedded from '@volar/language-core';

export function getProgram(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	core: embedded.EmbeddedLanguageContext,
	ls: ts.LanguageService,
) {

	const proxy: Partial<ts.Program> = {
		getRootFileNames,
		emit,
		getSyntacticDiagnostics,
		getSemanticDiagnostics,
		getGlobalDiagnostics,
		// @ts-expect-error
		getBindAndCheckDiagnostics,
	};

	return new Proxy({}, {
		get: (target: any, property: keyof ts.Program) => {
			if (property in proxy) {
				return proxy[property];
			}
			const program = getProgram();
			if (property in program) {
				return program[property];
			}
			return target[property];
		},
	});

	function getProgram() {
		return ls.getProgram()!;
	}

	function getRootFileNames() {
		return getProgram().getRootFileNames().filter(fileName => core.typescriptLanguageServiceHost.fileExists?.(fileName));
	}

	// for vue-tsc --noEmit --watch
	function getBindAndCheckDiagnostics(sourceFile?: ts.SourceFile, cancellationToken?: ts.CancellationToken) {
		return getSourceFileDiagnosticsWorker(sourceFile, cancellationToken, 'getBindAndCheckDiagnostics' as 'getSemanticDiagnostics');
	}

	// for vue-tsc --noEmit
	function getSyntacticDiagnostics(sourceFile?: ts.SourceFile, cancellationToken?: ts.CancellationToken) {
		return getSourceFileDiagnosticsWorker(sourceFile, cancellationToken, 'getSyntacticDiagnostics');
	}
	function getSemanticDiagnostics(sourceFile?: ts.SourceFile, cancellationToken?: ts.CancellationToken) {
		return getSourceFileDiagnosticsWorker(sourceFile, cancellationToken, 'getSemanticDiagnostics');
	}

	function getSourceFileDiagnosticsWorker<T extends 'getSyntacticDiagnostics' | 'getSemanticDiagnostics'>(
		sourceFile: ts.SourceFile | undefined,
		cancellationToken: ts.CancellationToken | undefined,
		api: T,
	): ReturnType<ts.Program[T]> {

		if (sourceFile) {

			const source = core.mapper.getSourceByVirtualFileName(sourceFile.fileName);

			if (source) {

				if (!source[2].capabilities.diagnostic)
					return [] as any;

				const errors = transformDiagnostics(ls.getProgram()?.[api](sourceFile, cancellationToken) ?? []);

				return errors as any;
			}
		}

		return transformDiagnostics(getProgram()[api](sourceFile, cancellationToken) ?? []) as any;
	}

	function getGlobalDiagnostics(cancellationToken?: ts.CancellationToken): readonly ts.Diagnostic[] {
		return transformDiagnostics(getProgram().getGlobalDiagnostics(cancellationToken) ?? []);
	}
	function emit(targetSourceFile?: ts.SourceFile, _writeFile?: ts.WriteFileCallback, cancellationToken?: ts.CancellationToken, emitOnlyDtsFiles?: boolean, customTransformers?: ts.CustomTransformers): ts.EmitResult {
		const scriptResult = getProgram().emit(targetSourceFile, (core.typescriptLanguageServiceHost.writeFile ?? ts.sys.writeFile), cancellationToken, emitOnlyDtsFiles, customTransformers);
		return {
			emitSkipped: scriptResult.emitSkipped,
			emittedFiles: scriptResult.emittedFiles,
			diagnostics: transformDiagnostics(scriptResult.diagnostics),
		};
	}

	// transform
	function transformDiagnostics<T extends ts.Diagnostic | ts.DiagnosticWithLocation | ts.DiagnosticRelatedInformation>(diagnostics: readonly T[]): T[] {
		const result: T[] = [];

		for (const diagnostic of diagnostics) {
			if (
				diagnostic.file !== undefined
				&& diagnostic.start !== undefined
				&& diagnostic.length !== undefined
			) {

				const source = core.mapper.getSourceByVirtualFileName(diagnostic.file.fileName);

				if (source) {

					if (core.typescriptLanguageServiceHost.fileExists?.(source[0]) === false)
						continue;

					const map = core.mapper.getSourceMap(source[2]);

					for (const start of map.toSourceOffsets(diagnostic.start)) {

						if (!start[1].data.diagnostic)
							continue;

						for (const end of map.toSourceOffsets(diagnostic.start + diagnostic.length, true)) {

							if (!end[1].data.diagnostic)
								continue;

							onMapping(diagnostic, source[0], start[0], end[0], source[1].getText(0, source[1].getLength()));
							break;
						}
						break;
					}
				}
				else {

					if (core.typescriptLanguageServiceHost.fileExists?.(diagnostic.file.fileName) === false)
						continue;

					onMapping(diagnostic, diagnostic.file.fileName, diagnostic.start, diagnostic.start + diagnostic.length, diagnostic.file.text);
				}
			}
			else if (diagnostic.file === undefined) {
				result.push(diagnostic);
			}
		}

		return result;

		function onMapping(diagnostic: T, fileName: string, start: number, end: number, docText: string | undefined) {

			let file = fileName === diagnostic.file?.fileName
				? diagnostic.file
				: undefined;
			if (!file) {

				if (docText === undefined) {
					const snapshot = core.typescriptLanguageServiceHost.getScriptSnapshot(fileName);
					if (snapshot) {
						docText = snapshot.getText(0, snapshot.getLength());
					}
				}
				else {
					file = ts.createSourceFile(fileName, docText, fileName.endsWith('.vue') || fileName.endsWith('.md') || fileName.endsWith('.html') ? ts.ScriptTarget.JSON : ts.ScriptTarget.Latest);
				}
			}
			const newDiagnostic: T = {
				...diagnostic,
				file,
				start: start,
				length: end - start,
			};
			const relatedInformation = (diagnostic as ts.Diagnostic).relatedInformation;
			if (relatedInformation) {
				(newDiagnostic as ts.Diagnostic).relatedInformation = transformDiagnostics(relatedInformation);
			}

			result.push(newDiagnostic);
		}
	}
}
