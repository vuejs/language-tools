import {
    D3Request,
    GetServerNameCasesRequest,
    PingRequest,
    RangeSemanticTokensRequest,
    RefCloseRequest,
    RestartServerNotification,
    SemanticTokenLegendRequest,
    uriToFsPath,
    VerifyAllScriptsRequest,
    WriteVirtualFilesRequest
} from '@volar/shared';
import * as fs from 'fs';
import * as path from 'upath';
import { TextDocument } from 'vscode-css-languageservice';
import {
    Connection,
    Diagnostic,
    DiagnosticSeverity,
    TextDocuments
} from 'vscode-languageserver/node';
import { semanticTokenLegend } from 'vscode-vue-languageservice';
import type { ServicesManager } from '../servicesManager';

export function register(
    connection: Connection,
    documents: TextDocuments<TextDocument>,
    servicesManager: ServicesManager,
) {
    connection.onNotification(RestartServerNotification.type, async () => {
        servicesManager.restartAll();
    });
    connection.onRequest(PingRequest.type, () => 'pong' as const);
    connection.onRequest(RefCloseRequest.type, handler => {
        const document = documents.get(handler.textDocument.uri);
        if (!document) return;
        return servicesManager.getMatchService(document.uri)?.__internal__.doRefAutoClose(document, handler.position);
    });
    connection.onRequest(D3Request.type, handler => {
        const document = documents.get(handler.uri);
        if (!document) return;
        return servicesManager.getMatchService(document.uri)?.__internal__.getD3(document);
    });
    connection.onRequest(WriteVirtualFilesRequest.type, async () => {
        const progress = await connection.window.createWorkDoneProgress();
        progress.begin('Write', 0, '', true);
        for (const [_, service] of servicesManager.services) {
            const ls = service.getLanguageServiceDontCreate();
            if (!ls) continue;
            const globalDocs = ls.__internal__.getGlobalDocs();
            for (const globalDoc of globalDocs) {
                await fs.writeFile.__promisify__(uriToFsPath(globalDoc.uri), globalDoc.getText(), "utf8");
            }
            const sourceFiles = ls.__internal__.getAllSourceFiles();
            let i = 0;
            for (const sourceFile of sourceFiles) {
                progress.report(i++ / sourceFiles.length * 100, path.relative(ls.__internal__.rootPath, uriToFsPath(sourceFile.uri)));
                for (const [uri, doc] of sourceFile.getTsDocuments()) {
                    if (progress.token.isCancellationRequested) {
                        break;
                    }
                    await fs.writeFile.__promisify__(uriToFsPath(uri), doc.getText(), "utf8");
                }
            }
        }
        progress.done();
    });
    connection.onRequest(VerifyAllScriptsRequest.type, async () => {

        let errors = 0;
        let warnings = 0;

        const progress = await connection.window.createWorkDoneProgress();
        progress.begin('Verify', 0, '', true);
        for (const [_, service] of servicesManager.services) {
            const ls = service.getLanguageServiceDontCreate();
            if (!ls) continue;
            const sourceFiles = ls.__internal__.getAllSourceFiles();
            let i = 0;
            for (const sourceFile of sourceFiles) {
                progress.report(i++ / sourceFiles.length * 100, path.relative(ls.__internal__.rootPath, uriToFsPath(sourceFile.uri)));
                if (progress.token.isCancellationRequested) {
                    continue;
                }
                let _result: Diagnostic[] = [];
                await ls.doValidation(sourceFile.uri, result => {
                    connection.sendDiagnostics({ uri: sourceFile.uri, diagnostics: result });
                    _result = result;
                });
                errors += _result.filter(error => error.severity === DiagnosticSeverity.Error).length;
                warnings += _result.filter(error => error.severity === DiagnosticSeverity.Warning).length;
            }
        }
        progress.done();

        connection.window.showInformationMessage(`Verification complete. Found ${errors} errors and ${warnings} warnings.`);
    });
    connection.onRequest(RangeSemanticTokensRequest.type, async handler => {
        return servicesManager
            .getMatchService(handler.textDocument.uri)
            ?.getSemanticTokens(handler.textDocument.uri, handler.range);
    });
    connection.onRequest(SemanticTokenLegendRequest.type, () => semanticTokenLegend);
    connection.onRequest(GetServerNameCasesRequest.type, handler => {
        return servicesManager.getMatchService(handler.uri)?.__internal__.detectTagNameCase(handler.uri);
    });
}
