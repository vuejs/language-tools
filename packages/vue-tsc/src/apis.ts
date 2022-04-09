import type * as ts from 'typescript/lib/tsserverlibrary';
import type { TypeScriptRuntime } from '@volar/vue-typescript';

export function register(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	context: TypeScriptRuntime,
) {

	return {
		getRootFileNames,
		emit,
		getSyntacticDiagnostics,
		getSemanticDiagnostics,
		getGlobalDiagnostics,
		getBindAndCheckDiagnostics,
	};

	function getRootFileNames() {
		return getProgram().getRootFileNames().filter(fileName => context.getTsLsHost().fileExists?.(fileName));
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

	function getSourceFileDiagnosticsWorker(
		sourceFile: ts.SourceFile | undefined,
		cancellationToken: ts.CancellationToken | undefined,
		api: 'getSyntacticDiagnostics' | 'getSemanticDiagnostics',
	): readonly ts.DiagnosticWithLocation[] | readonly ts.Diagnostic[] {

		if (sourceFile) {

			const mapped = context.vueFiles.fromEmbeddedFileName(sourceFile.fileName);

			if (mapped) {

				if (!mapped.embedded.file.capabilities.diagnostics)
					return [];

				const program = getProgram();
				const errors = transformDiagnostics(program?.[api](sourceFile, cancellationToken) ?? []);

				return errors;
			}
		}

		return transformDiagnostics(getProgram()[api](sourceFile, cancellationToken) ?? []);
	}

	function getGlobalDiagnostics(cancellationToken?: ts.CancellationToken): readonly ts.Diagnostic[] {
		return transformDiagnostics(getProgram().getGlobalDiagnostics(cancellationToken) ?? []);
	}
	function emit(targetSourceFile?: ts.SourceFile, _writeFile?: ts.WriteFileCallback, cancellationToken?: ts.CancellationToken, emitOnlyDtsFiles?: boolean, customTransformers?: ts.CustomTransformers): ts.EmitResult {
		const scriptResult = getProgram().emit(targetSourceFile, (context.vueLsHost.writeFile ?? ts.sys.writeFile), cancellationToken, emitOnlyDtsFiles, customTransformers);
		return {
			emitSkipped: scriptResult.emitSkipped,
			emittedFiles: scriptResult.emittedFiles,
			diagnostics: transformDiagnostics(scriptResult.diagnostics),
		};
	}
	function getProgram() {
		return context.getTsLs().getProgram()!;
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
				for (const tsOrVueLoc of context.vueFiles.fromEmbeddedLocation(
					diagnostic.file.fileName,
					diagnostic.start,
					diagnostic.start + diagnostic.length,
					data => !!data.capabilities.diagnostic,
				)) {

					if (!context.vueLsHost.fileExists?.(tsOrVueLoc.fileName))
						continue;

					let file = tsOrVueLoc.fileName === diagnostic.file.fileName
						? diagnostic.file
						: undefined;
					if (!file) {

						let docText = tsOrVueLoc.mapped?.vueFile.getContent();

						if (docText === undefined) {
							const snapshot = context.vueLsHost.getScriptSnapshot(tsOrVueLoc.fileName);
							if (snapshot) {
								docText = snapshot.getText(0, snapshot.getLength());
							}
						}
						else {
							file = ts.createSourceFile(tsOrVueLoc.fileName, docText, tsOrVueLoc.fileName.endsWith('.vue') ? ts.ScriptTarget.JSON : ts.ScriptTarget.Latest);
						}
					}
					const newDiagnostic: T = {
						...diagnostic,
						file,
						start: tsOrVueLoc.range.start,
						length: tsOrVueLoc.range.end - tsOrVueLoc.range.start,
					};
					const relatedInformation = (diagnostic as ts.Diagnostic).relatedInformation;
					if (relatedInformation) {
						(newDiagnostic as ts.Diagnostic).relatedInformation = transformDiagnostics(relatedInformation);
					}
					result.push(newDiagnostic);
				}
			}
			else if (
				diagnostic.file === undefined
			) {
				result.push(diagnostic);
			}
		}
		return result;
	}
}
