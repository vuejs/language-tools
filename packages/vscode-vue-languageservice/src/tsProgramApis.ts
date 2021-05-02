import type { TsApiRegisterOptions } from './types';
import * as ts from 'typescript';
import { fsPathToUri, normalizeFileName } from '@volar/shared';

export function register({ mapper, tsLanguageService, ts }: TsApiRegisterOptions) {

    return {
        getRootFileNames,
        emit,
        getSyntacticDiagnostics,
        getSemanticDiagnostics,
        getGlobalDiagnostics,
    };

    function getRootFileNames() {
        return getProgram().getRootFileNames()
            .filter(fileName => tsLanguageService.__internal__.host.fileExists?.(fileName));
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
        const program = tsLanguageService.__internal__.raw.getProgram();
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
                const fileName = normalizeFileName(tsLanguageService.__internal__.host.realpath?.(diagnostic.file.fileName) ?? diagnostic.file.fileName);
                let checkMode: 'all' | 'none' | 'unused' = 'all';
                if (mode) {
                    const uri = fsPathToUri(fileName);
                    const vueSourceFile = mapper.findSourceFileByTsUri(uri);
                    if (vueSourceFile) {
                        checkMode = vueSourceFile.shouldVerifyTsScript(uri, mode);
                    }
                }
                if (checkMode === 'none') continue;
                if (checkMode === 'unused' && !(diagnostic as ts.Diagnostic).reportsUnnecessary) continue;
                for (const tsOrVueRange of mapper.ts.from2(
                    fileName,
                    diagnostic.start,
                    diagnostic.start + diagnostic.length,
                )) {
                    if (!tsLanguageService.__internal__.host.fileExists?.(tsOrVueRange.fileName)) continue;
                    if (!tsOrVueRange.data || tsOrVueRange.data.capabilities.diagnostic) {
                        const file = tsOrVueRange.fileName === fileName
                            ? diagnostic.file
                            : ts.createSourceFile(tsOrVueRange.fileName, tsOrVueRange.textDocument.getText(), ts.ScriptTarget.JSON);
                        const newDiagnostic: T = {
                            ...diagnostic,
                            file,
                            start: tsOrVueRange.range.start,
                            length: tsOrVueRange.range.end - tsOrVueRange.range.start,
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
