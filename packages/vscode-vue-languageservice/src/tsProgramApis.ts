import type { ApiLanguageServiceContext } from './types';
import * as ts from 'typescript';
import { fsPathToUri, normalizeFileName } from '@volar/shared';

export function register({ sourceFiles, tsLs, ts }: ApiLanguageServiceContext) {

    return {
        getRootFileNames,
        emit,
        getSyntacticDiagnostics,
        getSemanticDiagnostics,
        getGlobalDiagnostics,
    };

    function getRootFileNames() {
        return getProgram().getRootFileNames()
            .filter(fileName => tsLs.__internal__.host.fileExists?.(fileName));
    }
    function getSyntacticDiagnostics(sourceFile?: ts.SourceFile, cancellationToken?: ts.CancellationToken): readonly ts.DiagnosticWithLocation[] {
        const result = getProgram().getSyntacticDiagnostics(sourceFile, cancellationToken);
        return transformDiagnostics(result, 2);
    }
    function getSemanticDiagnostics(sourceFile?: ts.SourceFile, cancellationToken?: ts.CancellationToken): readonly ts.Diagnostic[] {
        const result = getProgram().getSemanticDiagnostics(sourceFile, cancellationToken);
        return transformDiagnostics(result, 1);
    }
    function getGlobalDiagnostics(cancellationToken?: ts.CancellationToken): readonly ts.Diagnostic[] {
        const result = getProgram().getGlobalDiagnostics(cancellationToken);
        return transformDiagnostics(result);
    }
    function emit(targetSourceFile?: ts.SourceFile, writeFile?: ts.WriteFileCallback, cancellationToken?: ts.CancellationToken, emitOnlyDtsFiles?: boolean, customTransformers?: ts.CustomTransformers): ts.EmitResult {
        const result = getProgram().emit(targetSourceFile, writeFile, cancellationToken, emitOnlyDtsFiles, customTransformers);
        return {
            ...result,
            diagnostics: transformDiagnostics(result.diagnostics),
        };
    }
    function getProgram() {
        const program = tsLs.__internal__.raw.getProgram();
        if (!program) throw '!program';
        return program;
    }

    // transform
    function transformDiagnostics<T extends ts.Diagnostic | ts.DiagnosticWithLocation | ts.DiagnosticRelatedInformation>(diagnostics: readonly T[], mode?: 1 | 2 | 3 | 4): T[] {
        const result: T[] = [];
        for (const diagnostic of diagnostics) {
            if (
                diagnostic.file !== undefined
                && diagnostic.start !== undefined
                && diagnostic.length !== undefined
            ) {
                const fileName = normalizeFileName(tsLs.__internal__.host.realpath?.(diagnostic.file.fileName) ?? diagnostic.file.fileName);
                let checkMode: 'all' | 'none' | 'unused' = 'all';
                if (mode) {
                    const uri = fsPathToUri(fileName);
                    const vueSourceFile = sourceFiles.getSourceFileByTsUri(uri);
                    if (vueSourceFile) {
                        checkMode = vueSourceFile.shouldVerifyTsScript(uri, mode);
                    }
                }
                if (checkMode === 'none') continue;
                if (checkMode === 'unused' && !(diagnostic as ts.Diagnostic).reportsUnnecessary) continue;
                for (const tsOrVueLoc of sourceFiles.fromTsLocation2(
                    fsPathToUri(fileName),
                    diagnostic.start,
                    diagnostic.start + diagnostic.length,
                )) {

                    if (!tsLs.__internal__.host.fileExists?.(fsPathToUri(tsOrVueLoc.uri)))
                        continue;

                    if (tsOrVueLoc.type === 'source-ts' || tsOrVueLoc.range.data.capabilities.diagnostic) {
                        let file = fsPathToUri(tsOrVueLoc.uri) === fileName
                            ? diagnostic.file
                            : undefined;
                        if (!file) {
                            const doc = tsOrVueLoc.type === 'embedded-ts'
                                ? tsOrVueLoc.sourceMap.sourceDocument
                                : tsLs.__internal__.getTextDocument(tsOrVueLoc.uri);
                            if (doc) {
                                file = ts.createSourceFile(fsPathToUri(tsOrVueLoc.uri), doc.getText(), tsOrVueLoc.type === 'embedded-ts' ? ts.ScriptTarget.JSON : ts.ScriptTarget.Latest /* TODO */)
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
