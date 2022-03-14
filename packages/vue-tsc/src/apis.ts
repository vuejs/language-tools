import * as shared from '@volar/shared';
import type * as ts from 'typescript/lib/tsserverlibrary';
import type { TypeScriptFeaturesRuntimeContext } from '@volar/vue-typescript';

const lsTypes = ['script', 'template'] as const;

export function register(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	{ vueDocuments, templateTsLsRaw, scriptTsLsRaw, templateTsHost, scriptTsHost, vueHost }: TypeScriptFeaturesRuntimeContext,
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
			...getProgram('script')?.getRootFileNames().filter(fileName => scriptTsHost.fileExists?.(fileName)) ?? [],
			...getProgram('template')?.getRootFileNames().filter(fileName => templateTsHost?.fileExists?.(fileName)) ?? [],
		]);
		return [...set.values()];
	}

	// for vue-tsc --noEmit --watch
	function getBindAndCheckDiagnostics(sourceFile?: ts.SourceFile, cancellationToken?: ts.CancellationToken) {
		return getSourceFileDiagnosticsWorker(sourceFile, cancellationToken, 'getBindAndCheckDiagnostics');
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
		api: 'getBindAndCheckDiagnostics' | 'getSyntacticDiagnostics' | 'getSemanticDiagnostics',
	): readonly ts.DiagnosticWithLocation[] | readonly ts.Diagnostic[] {

		if (sourceFile) {

			const sourceMap = vueDocuments.fromEmbeddedDocumentUri('script', shared.fsPathToUri(sourceFile.fileName));
			const vueDocument = sourceMap ? vueDocuments.get(sourceMap.sourceDocument.uri) : undefined;

			if (vueDocument) {

				let results: any[] = [];

				const sourceMaps = vueDocument.getSourceMaps();

				for (const sourceMap of sourceMaps) {

					if (sourceMap.lsType === 'nonTs' || !sourceMap.capabilities.diagnostics)
						continue;

					const program = getProgram(sourceMap.lsType);
					const embeddedSourceFile = program?.getSourceFile(shared.uriToFsPath(sourceMap.mappedDocument.uri));

					if (embeddedSourceFile) {

						const errors = transformDiagnostics(sourceMap.lsType, (program as any)[api](embeddedSourceFile, cancellationToken));
						results = results.concat(errors);
					}
				}

				return results;
			}
			else {
				return (getProgram('script') as any)[api](sourceFile, cancellationToken);
			}
		}

		return lsTypes.map(lsType => transformDiagnostics(lsType, (getProgram(lsType) as any)[api](sourceFile, cancellationToken))).flat();
	}

	function getGlobalDiagnostics(cancellationToken?: ts.CancellationToken): readonly ts.Diagnostic[] {
		return lsTypes.map(lsType => transformDiagnostics(lsType, getProgram(lsType)?.getGlobalDiagnostics(cancellationToken) ?? [])).flat();
	}
	function emit(targetSourceFile?: ts.SourceFile, _writeFile?: ts.WriteFileCallback, cancellationToken?: ts.CancellationToken, emitOnlyDtsFiles?: boolean, customTransformers?: ts.CustomTransformers): ts.EmitResult {
		const scriptResult = getProgram('script')!.emit(targetSourceFile, (vueHost.writeFile ?? ts.sys.writeFile), cancellationToken, emitOnlyDtsFiles, customTransformers);
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
		return (lsType === 'script' ? scriptTsLsRaw : templateTsLsRaw)?.getProgram();
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
				const fileName = shared.normalizeFileName(diagnostic.file.fileName);
				for (const tsOrVueLoc of vueDocuments.fromEmbeddedLocation(
					lsType,
					shared.fsPathToUri(fileName),
					diagnostic.start,
					diagnostic.start + diagnostic.length,
					data => !!data.capabilities.diagnostic,
				)) {

					if (!vueHost.fileExists?.(shared.uriToFsPath(tsOrVueLoc.uri)))
						continue;

					if (tsOrVueLoc.type === 'source-ts' && lsType !== 'script')
						continue;

					let file = shared.uriToFsPath(tsOrVueLoc.uri) === fileName
						? diagnostic.file
						: undefined;
					if (!file) {

						let docText = tsOrVueLoc.sourceMap?.sourceDocument.getText();

						if (docText === undefined) {
							const snapshot = vueHost.getScriptSnapshot(shared.uriToFsPath(tsOrVueLoc.uri));
							if (snapshot) {
								docText = snapshot.getText(0, snapshot.getLength());
							}
						}

						if (docText !== undefined) {
							file = ts.createSourceFile(shared.uriToFsPath(tsOrVueLoc.uri), docText, tsOrVueLoc.uri.endsWith('.vue') ? ts.ScriptTarget.JSON : ts.ScriptTarget.Latest)
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
