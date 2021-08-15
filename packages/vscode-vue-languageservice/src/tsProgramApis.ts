import type { ApiLanguageServiceContext } from './types';
import type * as ts from 'typescript/lib/tsserverlibrary';
import * as shared from '@volar/shared';

const lsTypes = ['script', 'template'] as const;

export function register({ modules: { typescript: ts }, sourceFiles, templateTsLsRaw, scriptTsLsRaw, templateTsHost, scriptTsHost, vueHost }: ApiLanguageServiceContext) {

	return {
		getRootFileNames,
		emit,
		getSyntacticDiagnostics,
		getSemanticDiagnostics,
		getGlobalDiagnostics,
	};

	function getRootFileNames() {
		const set = new Set([
			...getProgram('script').getRootFileNames().filter(fileName => scriptTsHost.fileExists?.(fileName)),
			...getProgram('template').getRootFileNames().filter(fileName => templateTsHost.fileExists?.(fileName)),
		]);
		return [...set.values()];
	}
	function getSyntacticDiagnostics(sourceFile?: ts.SourceFile, cancellationToken?: ts.CancellationToken): readonly ts.DiagnosticWithLocation[] {
		return lsTypes.map(lsType => transformDiagnostics(lsType, getProgram(lsType).getSyntacticDiagnostics(sourceFile, cancellationToken), 2)).flat();
	}
	function getSemanticDiagnostics(sourceFile?: ts.SourceFile, cancellationToken?: ts.CancellationToken): readonly ts.Diagnostic[] {
		return lsTypes.map(lsType => transformDiagnostics(lsType, getProgram(lsType).getSemanticDiagnostics(sourceFile, cancellationToken), 1)).flat();
	}
	function getGlobalDiagnostics(cancellationToken?: ts.CancellationToken): readonly ts.Diagnostic[] {
		return lsTypes.map(lsType => transformDiagnostics(lsType, getProgram(lsType).getGlobalDiagnostics(cancellationToken))).flat();
	}
	function emit(targetSourceFile?: ts.SourceFile, writeFile?: ts.WriteFileCallback, cancellationToken?: ts.CancellationToken, emitOnlyDtsFiles?: boolean, customTransformers?: ts.CustomTransformers): ts.EmitResult {
		const scriptResult = getProgram('script').emit(targetSourceFile, writeFile, cancellationToken, emitOnlyDtsFiles, customTransformers);
		const templateResult = getProgram('template').emit(targetSourceFile, writeFile, cancellationToken, emitOnlyDtsFiles, customTransformers);
		return {
			emitSkipped: scriptResult.emitSkipped,
			emittedFiles: scriptResult.emittedFiles,
			diagnostics: [
				...transformDiagnostics('script', scriptResult.diagnostics),
				...transformDiagnostics('template', templateResult.diagnostics),
			],
		};
	}
	function getProgram(lsType: 'script' | 'template') {
		const program = (lsType === 'script' ? scriptTsLsRaw : templateTsLsRaw).getProgram();
		if (!program) throw '!program';
		return program;
	}

	// transform
	function transformDiagnostics<T extends ts.Diagnostic | ts.DiagnosticWithLocation | ts.DiagnosticRelatedInformation>(lsType: 'script' | 'template', diagnostics: readonly T[], mode?: 1 | 2 | 3 | 4): T[] {
		const result: T[] = [];
		const tsLsHost = lsType === 'script' ? scriptTsHost : templateTsHost;
		for (const diagnostic of diagnostics) {
			if (
				diagnostic.file !== undefined
				&& diagnostic.start !== undefined
				&& diagnostic.length !== undefined
			) {
				const fileName = shared.normalizeFileName(tsLsHost.realpath?.(diagnostic.file.fileName) ?? diagnostic.file.fileName);
				for (const tsOrVueLoc of sourceFiles.fromTsLocation2(
					lsType,
					shared.fsPathToUri(fileName),
					diagnostic.start,
					diagnostic.start + diagnostic.length,
				)) {

					if (!vueHost.fileExists?.(shared.uriToFsPath(tsOrVueLoc.uri)))
						continue;

					if (tsOrVueLoc.type === 'embedded-ts' && !tsOrVueLoc.range.data.capabilities.diagnostic)
						continue;

					if (tsOrVueLoc.type === 'source-ts' && tsOrVueLoc.lsType === 'template')
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
