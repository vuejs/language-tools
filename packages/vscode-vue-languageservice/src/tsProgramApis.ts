import type { ApiLanguageServiceContext } from './types';
import * as ts from 'typescript';
import * as shared from '@volar/shared';

const lsTypes = ['script', 'template'] as const;

export function register({ sourceFiles, ts, getTsLs, templateTsLs, scriptTsLs, vueHost }: ApiLanguageServiceContext) {

	return {
		getRootFileNames,
		emit,
		getSyntacticDiagnostics,
		getSemanticDiagnostics,
		getGlobalDiagnostics,
	};

	function getRootFileNames() {
		const set = new Set([
			...getProgram('script').getRootFileNames().filter(fileName => scriptTsLs.__internal__.host.fileExists?.(fileName)),
			...getProgram('template').getRootFileNames().filter(fileName => templateTsLs.__internal__.host.fileExists?.(fileName)),
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
		const program = (lsType === 'script' ? scriptTsLs : templateTsLs).__internal__.raw.getProgram();
		if (!program) throw '!program';
		return program;
	}

	// transform
	function transformDiagnostics<T extends ts.Diagnostic | ts.DiagnosticWithLocation | ts.DiagnosticRelatedInformation>(lsType: 'script' | 'template', diagnostics: readonly T[], mode?: 1 | 2 | 3 | 4): T[] {
		const result: T[] = [];
		const tsLs = getTsLs(lsType);
		for (const diagnostic of diagnostics) {
			if (
				diagnostic.file !== undefined
				&& diagnostic.start !== undefined
				&& diagnostic.length !== undefined
			) {
				const fileName = shared.normalizeFileName(tsLs.__internal__.host.realpath?.(diagnostic.file.fileName) ?? diagnostic.file.fileName);
				let checkMode: 'all' | 'none' | 'unused' = 'all';
				if (mode) {
					const uri = shared.fsPathToUri(fileName);
					const vueSourceFile = sourceFiles.getSourceFileByTsUri(lsType, uri);
					if (vueSourceFile) {
						checkMode = vueSourceFile.shouldVerifyTsScript(uri, mode);
					}
				}
				if (checkMode === 'none') continue;
				if (checkMode === 'unused' && !(diagnostic as ts.Diagnostic).reportsUnnecessary) continue;
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
						const doc = tsOrVueLoc.type === 'embedded-ts'
							? tsOrVueLoc.sourceMap.sourceDocument
							: tsLs.__internal__.getTextDocument(tsOrVueLoc.uri);
						if (doc) {
							file = ts.createSourceFile(shared.uriToFsPath(tsOrVueLoc.uri), doc.getText(), tsOrVueLoc.uri.endsWith('.vue') ? ts.ScriptTarget.JSON : ts.ScriptTarget.Latest)
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
