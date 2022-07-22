import type * as ts from 'typescript/lib/tsserverlibrary';
import type * as vue from '@volar/vue-language-core';

export function getProgram(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	core: vue.LanguageContext,
	vueTsLs: ts.LanguageService,
) {

	const program = vueTsLs.getProgram()!;
	const proxy: Partial<ts.Program> = {
		getRootFileNames,
		emit,
		getSyntacticDiagnostics,
		getSemanticDiagnostics,
		getGlobalDiagnostics,
		// @ts-expect-error
		getBindAndCheckDiagnostics,
	};

	return new Proxy(program, {
		get: (target: any, property: keyof ts.Program) => {
			if (property in proxy) {
				return proxy[property];
			}
			return target[property];
		},
	});

	function getRootFileNames() {
		return program.getRootFileNames().filter(fileName => core.typescriptLanguageServiceHost.fileExists?.(fileName));
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

				if (!mapped.embedded.file.capabilities.diagnostics)
					return [] as any;

				const errors = transformDiagnostics(program?.[api](sourceFile, cancellationToken) ?? []);

				return errors as any;
			}
		}

		return transformDiagnostics(program[api](sourceFile, cancellationToken) ?? []) as any;
	}

	function getGlobalDiagnostics(cancellationToken?: ts.CancellationToken): readonly ts.Diagnostic[] {
		return transformDiagnostics(program.getGlobalDiagnostics(cancellationToken) ?? []);
	}
	function emit(targetSourceFile?: ts.SourceFile, _writeFile?: ts.WriteFileCallback, cancellationToken?: ts.CancellationToken, emitOnlyDtsFiles?: boolean, customTransformers?: ts.CustomTransformers): ts.EmitResult {
		const scriptResult = program.emit(targetSourceFile, (core.typescriptLanguageServiceHost.writeFile ?? ts.sys.writeFile), cancellationToken, emitOnlyDtsFiles, customTransformers);
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

				let founded = false;

				for (const tsOrVueLoc of core.mapper.fromEmbeddedLocation(
					diagnostic.file.fileName,
					diagnostic.start,
					diagnostic.start + diagnostic.length,
					data => !!data.capabilities.diagnostic,
				)) {

					if (!core.typescriptLanguageServiceHost.fileExists?.(tsOrVueLoc.fileName))
						continue;

					onMapping(diagnostic, tsOrVueLoc.fileName, tsOrVueLoc.range.start, tsOrVueLoc.range.end, tsOrVueLoc.mapped?.vueFile.text);

					founded = true;
					break;
				}

				// fix https://github.com/johnsoncodehk/volar/issues/1372
				if (!founded) {
					for (const start of core.mapper.fromEmbeddedLocation(
						diagnostic.file.fileName,
						diagnostic.start,
						diagnostic.start,
						data => !!data.capabilities.diagnostic,
					)) {

						if (!core.typescriptLanguageServiceHost.fileExists?.(start.fileName))
							continue;

						for (const end of core.mapper.fromEmbeddedLocation(
							diagnostic.file.fileName,
							diagnostic.start + diagnostic.length,
							diagnostic.start + diagnostic.length,
							data => !!data.capabilities.diagnostic,
						)) {

							if (!core.typescriptLanguageServiceHost.fileExists?.(end.fileName))
								continue;

							if (start.fileName !== end.fileName)
								continue;

							onMapping(diagnostic, start.fileName, start.range.start, end.range.end, start.mapped?.vueFile.text);

							founded = true;
							break;
						}
						if (founded) {
							break;
						}
					}
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
