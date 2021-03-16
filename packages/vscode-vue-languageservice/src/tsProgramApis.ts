import type { TsApiRegisterOptions } from './types';
import * as ts from 'typescript';
import { normalizeFileName } from '@volar/shared';

export function register({ mapper, tsLanguageService, ts }: TsApiRegisterOptions) {

    return {
        getRootFileNames,
        emit,
        getSyntacticDiagnostics,
        getSemanticDiagnostics,
        getGlobalDiagnostics,
    };

    function getRootFileNames() {
        const program = getOriginalProgram();
        return program.getRootFileNames()
            .filter(fileName => tsLanguageService.host.fileExists?.(fileName));
    }
    function getSyntacticDiagnostics(sourceFile?: ts.SourceFile, cancellationToken?: ts.CancellationToken): readonly ts.DiagnosticWithLocation[] {
        const program = getOriginalProgram();
        const result = program.getSyntacticDiagnostics(sourceFile, cancellationToken);
        return transformDiagnostics(result);
    }
    function getSemanticDiagnostics(sourceFile?: ts.SourceFile, cancellationToken?: ts.CancellationToken): readonly ts.Diagnostic[] {
        const program = getOriginalProgram();
        const result = program.getSemanticDiagnostics(sourceFile, cancellationToken);
        return transformDiagnostics(result);
    }
    function getGlobalDiagnostics(cancellationToken?: ts.CancellationToken): readonly ts.Diagnostic[] {
        const program = getOriginalProgram();
        const result = program.getGlobalDiagnostics(cancellationToken);
        return transformDiagnostics(result);
    }
    function emit(targetSourceFile?: ts.SourceFile, writeFile?: ts.WriteFileCallback, cancellationToken?: ts.CancellationToken, emitOnlyDtsFiles?: boolean, customTransformers?: ts.CustomTransformers): ts.EmitResult {
        const program = getOriginalProgram();
        const result = program.emit(targetSourceFile, writeFile, cancellationToken, emitOnlyDtsFiles, customTransformers);
        return {
            ...result,
            diagnostics: transformDiagnostics(result.diagnostics),
        };
    }
    function getOriginalProgram() {
        const program = tsLanguageService.raw.getProgram();
        if (!program) throw '!program';
        return program;
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
                const fileName = normalizeFileName(tsLanguageService.host.realpath?.(diagnostic.file.fileName) ?? diagnostic.file.fileName);
                for (const tsOrVueRange of mapper.ts.from2(
                    fileName,
                    diagnostic.start,
                    diagnostic.start + diagnostic.length,
                )) {
                    if (!tsLanguageService.host.fileExists?.(tsOrVueRange.fileName)) continue;
                    if (!tsOrVueRange.data || tsOrVueRange.data.capabilities.diagnostic) {
                        const file = tsOrVueRange.fileName === fileName
                            ? diagnostic.file
                            : ts.createSourceFile(tsOrVueRange.fileName, tsOrVueRange.textDocument.getText(), ts.ScriptTarget.JSON);
                        const newDiagnostic: T = {
                            ...diagnostic,
                            file,
                            start: tsOrVueRange.start,
                            length: tsOrVueRange.end - tsOrVueRange.start,
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
