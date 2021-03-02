import type { TsApiRegisterOptions } from './types';
import type {
    SourceFile,
    WriteFileCallback,
    CancellationToken,
    CustomTransformers,
    EmitResult,
    Diagnostic,
    DiagnosticWithLocation,
} from 'typescript';

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
    function getSyntacticDiagnostics(sourceFile?: SourceFile, cancellationToken?: CancellationToken): readonly DiagnosticWithLocation[] {
        const program = getOriginalProgram();
        const result = program.getSyntacticDiagnostics(sourceFile, cancellationToken);
        return transformDiagnosticWithLocations(result);
    }
    function getSemanticDiagnostics(sourceFile?: SourceFile, cancellationToken?: CancellationToken): readonly Diagnostic[] {
        const program = getOriginalProgram();
        const result = program.getSemanticDiagnostics(sourceFile, cancellationToken);
        return transformDiagnostics(result);
    }
    function getGlobalDiagnostics(cancellationToken?: CancellationToken): readonly Diagnostic[] {
        const program = getOriginalProgram();
        const result = program.getGlobalDiagnostics(cancellationToken);
        return transformDiagnostics(result);
    }
    function emit(targetSourceFile?: SourceFile, writeFile?: WriteFileCallback, cancellationToken?: CancellationToken, emitOnlyDtsFiles?: boolean, customTransformers?: CustomTransformers): EmitResult {
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
    function transformDiagnosticWithLocations(diagnostics: readonly DiagnosticWithLocation[]): readonly DiagnosticWithLocation[] {
        // console.log(diagnostics);
        const result: DiagnosticWithLocation[] = [];
        for (const diagnostic of diagnostics) {
            for (const tsOrVueRange of mapper.ts.from2(
                diagnostic.file.fileName,
                diagnostic.start,
                diagnostic.start + diagnostic.length,
            )) {
                if (!tsLanguageService.host.fileExists?.(tsOrVueRange.fileName)) continue;
                if (!tsOrVueRange.data || tsOrVueRange.data.capabilities.diagnostic) {
                    result.push({
                        ...diagnostic,
                        file: ts.createSourceFile(tsOrVueRange.fileName, tsOrVueRange.textDocument.getText(), ts.ScriptTarget.JSON),
                        start: tsOrVueRange.start,
                        length: tsOrVueRange.end - tsOrVueRange.start,
                    });
                }
            }
        }
        return result;
    }
    function transformDiagnostics(diagnostics: readonly Diagnostic[]): readonly Diagnostic[] {
        const result: Diagnostic[] = [];
        for (const diagnostic of diagnostics) {
            if (
                diagnostic.file !== undefined
                && diagnostic.start !== undefined
                && diagnostic.length !== undefined
            ) {
                const fileName = tsLanguageService.host.realpath?.(diagnostic.file.fileName);
                if (!fileName) continue;
                for (const tsOrVueRange of mapper.ts.from2(
                    fileName,
                    diagnostic.start,
                    diagnostic.start + diagnostic.length,
                )) {
                    if (!tsLanguageService.host.fileExists?.(tsOrVueRange.fileName)) continue;
                    if (!tsOrVueRange.data || tsOrVueRange.data.capabilities.diagnostic) {
                        result.push({
                            ...diagnostic,
                            file: ts.createSourceFile(tsOrVueRange.fileName, tsOrVueRange.textDocument.getText(), ts.ScriptTarget.JSON),
                            start: tsOrVueRange.start,
                            length: tsOrVueRange.end - tsOrVueRange.start,
                        });
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
