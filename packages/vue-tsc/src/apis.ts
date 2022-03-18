import type * as ts from 'typescript/lib/tsserverlibrary';
import type { TypeScriptRuntime } from '@volar/vue-typescript';

const lsTypes = ['script', 'template'] as const;

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
		const set = new Set([
			...getProgram('script')?.getRootFileNames().filter(fileName => context.getTsLsHost('script').fileExists?.(fileName)) ?? [],
			...getProgram('template')?.getRootFileNames().filter(fileName => context.getTsLsHost('template')?.fileExists?.(fileName)) ?? [],
		]);
		return [...set.values()];
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

			const maped = context.vueFiles.fromEmbeddedFileName('script', sourceFile.fileName);

			if (maped) {

				let results: any[] = [];

				const embeddeds = maped.vueFile.getAllEmbeddeds();

				for (const embedded of embeddeds) {

					if (embedded.file.lsType === 'nonTs' || !embedded.file.capabilities.diagnostics)
						continue;

					const program = getProgram(embedded.file.lsType);
					const embeddedSourceFile = program?.getSourceFile(embedded.file.fileName);

					if (embeddedSourceFile) {

						const errors = transformDiagnostics(embedded.file.lsType, program?.[api](embeddedSourceFile, cancellationToken) ?? []);
						results = results.concat(errors);
					}
				}

				return results;
			}
			else {
				return getProgram('script')?.[api](sourceFile, cancellationToken) ?? [];
			}
		}

		return lsTypes.map(lsType => transformDiagnostics(lsType, getProgram(lsType)?.[api](sourceFile, cancellationToken) ?? [])).flat();
	}

	function getGlobalDiagnostics(cancellationToken?: ts.CancellationToken): readonly ts.Diagnostic[] {
		return lsTypes.map(lsType => transformDiagnostics(lsType, getProgram(lsType)?.getGlobalDiagnostics(cancellationToken) ?? [])).flat();
	}
	function emit(targetSourceFile?: ts.SourceFile, _writeFile?: ts.WriteFileCallback, cancellationToken?: ts.CancellationToken, emitOnlyDtsFiles?: boolean, customTransformers?: ts.CustomTransformers): ts.EmitResult {
		const scriptResult = getProgram('script')!.emit(targetSourceFile, (context.vueLsHost.writeFile ?? ts.sys.writeFile), cancellationToken, emitOnlyDtsFiles, customTransformers);
		const templateResult = getProgram('template')?.emit(targetSourceFile, undefined, cancellationToken, emitOnlyDtsFiles, customTransformers);
		return {
			emitSkipped: scriptResult.emitSkipped,
			emittedFiles: scriptResult.emittedFiles,
			diagnostics: [
				...transformDiagnostics('script', scriptResult.diagnostics),
				...transformDiagnostics('template', templateResult?.diagnostics ?? []),
			],
		};
	}
	function getProgram(lsType: 'script' | 'template') {
		return context.getTsLs(lsType)?.getProgram();
	}

	// transform
	function transformDiagnostics<T extends ts.Diagnostic | ts.DiagnosticWithLocation | ts.DiagnosticRelatedInformation>(lsType: 'script' | 'template', diagnostics: readonly T[]): T[] {
		const result: T[] = [];
		for (const diagnostic of diagnostics) {
			if (
				diagnostic.file !== undefined
				&& diagnostic.start !== undefined
				&& diagnostic.length !== undefined
			) {
				for (const tsOrVueLoc of context.vueFiles.fromEmbeddedLocation(
					lsType,
					diagnostic.file.fileName,
					diagnostic.start,
					diagnostic.start + diagnostic.length,
					data => !!data.capabilities.diagnostic,
				)) {

					if (!context.vueLsHost.fileExists?.(tsOrVueLoc.fileName))
						continue;

					if (!tsOrVueLoc.maped && lsType !== 'script')
						continue;

					let file = tsOrVueLoc.fileName === diagnostic.file.fileName
						? diagnostic.file
						: undefined;
					if (!file) {

						let docText = tsOrVueLoc.maped?.vueFile.getContent();

						if (docText === undefined) {
							const snapshot = context.vueLsHost.getScriptSnapshot(tsOrVueLoc.fileName);
							if (snapshot) {
								docText = snapshot.getText(0, snapshot.getLength());
							}
						}
						else {
							file = ts.createSourceFile(tsOrVueLoc.fileName, docText, tsOrVueLoc.fileName.endsWith('.vue') ? ts.ScriptTarget.JSON : ts.ScriptTarget.Latest)
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
						(newDiagnostic as ts.Diagnostic).relatedInformation = transformDiagnostics(lsType, relatedInformation);
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
