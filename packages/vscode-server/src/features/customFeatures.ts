import {
    D3Request,
    GetServerNameCasesRequest,
    RangeSemanticTokensRequest,
    RefCloseRequest,
    RestartServerNotification,
    SemanticTokenLegendRequest,
    uriToFsPath,
    VerifyAllScriptsRequest,
    WriteVirtualFilesRequest
} from '@volar/shared';
import { semanticTokenLegend } from '@volar/vscode-vue-languageservice';
import * as fs from 'fs-extra';
import * as path from 'upath';
import { TextDocument } from 'vscode-css-languageservice';
import {
    Connection,
    Diagnostic,
    DiagnosticSeverity,
    TextDocuments
} from 'vscode-languageserver/node';
import type { ServicesManager } from '../servicesManager';

export function register(
    connection: Connection,
    documents: TextDocuments<TextDocument>,
    servicesManager: ServicesManager,
) {
    connection.onNotification(RestartServerNotification.type, async () => {
        servicesManager.restartAll();
    });
    connection.onRequest(RefCloseRequest.type, handler => {
        const document = documents.get(handler.textDocument.uri);
        if (!document) return;
        return servicesManager.getMatchService(document.uri)?.doRefAutoClose(document, handler.position);
    });
    connection.onRequest(D3Request.type, handler => {
        const document = documents.get(handler.uri);
        if (!document) return;
        return servicesManager.getMatchService(document.uri)?.getD3(document);
    });
    connection.onRequest(WriteVirtualFilesRequest.type, async () => {
        const progress = await connection.window.createWorkDoneProgress();
        progress.begin('Write', 0, '', true);
        for (const [_, service] of servicesManager.services) {
            const ls = service.getLanguageServiceDontCreate();
            if (!ls) continue;
            const globalDocs = ls.getGlobalDocs();
            for (const globalDoc of globalDocs) {
                await fs.writeFile(uriToFsPath(globalDoc.uri), globalDoc.getText(), "utf8");
            }
            const sourceFiles = ls.getAllSourceFiles();
            let i = 0;
            for (const sourceFile of sourceFiles) {
                progress.report(i++ / sourceFiles.length * 100, path.relative(ls.rootPath, uriToFsPath(sourceFile.uri)));
                for (const [uri, doc] of sourceFile.getTsDocuments()) {
                    if (progress.token.isCancellationRequested) {
                        break;
                    }
                    await fs.writeFile(uriToFsPath(uri), doc.getText(), "utf8");
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
            const sourceFiles = ls.getAllSourceFiles();
            let i = 0;
            for (const sourceFile of sourceFiles) {
                progress.report(i++ / sourceFiles.length * 100, path.relative(ls.rootPath, uriToFsPath(sourceFile.uri)));
                if (progress.token.isCancellationRequested) {
                    continue;
                }
                const doc = sourceFile.getTextDocument();
                let _result: Diagnostic[] = [];
                await ls.doValidation(doc, result => {
                    connection.sendDiagnostics({ uri: doc.uri, diagnostics: result });
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
        const document = documents.get(handler.textDocument.uri);
        if (!document) return;
        return servicesManager.getMatchService(document.uri)?.getSemanticTokens(document, handler.range);
    });
    connection.onRequest(SemanticTokenLegendRequest.type, () => semanticTokenLegend);
    connection.onRequest(GetServerNameCasesRequest.type, handler => {
        return servicesManager.getMatchService(handler.uri)?.detectTagNameCase(handler.uri);
    });
}
