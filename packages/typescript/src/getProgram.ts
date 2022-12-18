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

			const mapped = core.mapper.fromEmbeddedFileName(sourceFile.fileName);

			if (mapped) {

				if (!mapped.embedded.capabilities.diagnostic)
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

				for (const start of core.mapper.fromEmbeddedLocation(diagnostic.file.fileName, diagnostic.start)) {

					if (start.mapping && !start.mapping.data.diagnostic)
						continue;

					if (!core.typescriptLanguageServiceHost.fileExists?.(start.fileName))
						continue;

					for (const end of core.mapper.fromEmbeddedLocation(
						diagnostic.file.fileName,
						diagnostic.start + diagnostic.length,
						true,
					)) {

						if (end.mapping && !end.mapping.data.diagnostic)
							continue;

						onMapping(diagnostic, start.fileName, start.offset, end.offset, core.mapper.get(start.fileName)?.[0].text);

						break;
					}
					break;
				}
			}
			else if (
				diagnostic.file === undefined
			) {
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
