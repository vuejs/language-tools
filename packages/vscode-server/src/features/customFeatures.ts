import {
    D3Request,
    FormatAllScriptsRequest,
    RangeSemanticTokensRequest,
    RefCloseRequest,
    RestartServerNotification,
    SemanticTokenLegendRequest,
    TagCloseRequest,
    uriToFsPath,
    VerifyAllScriptsRequest,
    WriteVirtualFilesRequest
} from '@volar/shared';
import { semanticTokenLegend } from '@volar/vscode-vue-languageservice';
import * as fs from 'fs-extra';
import * as path from 'upath';
import {
    Diagnostic,
    DiagnosticSeverity,
    WorkspaceEdit
} from 'vscode-languageserver/node';
import {
    connection,
    documents,
    host,
    noStateLs
} from '../instances';

connection.onNotification(RestartServerNotification.type, async () => {
    host?.restart();
});
connection.onRequest(RefCloseRequest.type, handler => {
    const document = documents.get(handler.textDocument.uri);
    if (!document) return;
    return host?.bestMatch(document.uri)?.doRefAutoClose(document, handler.position);
});
connection.onRequest(D3Request.type, handler => {
    const document = documents.get(handler.uri);
    if (!document) return;
    return host?.bestMatch(document.uri)?.getD3(document);
});
connection.onRequest(FormatAllScriptsRequest.type, async options => {
    if (!host) return;
    const progress = await connection.window.createWorkDoneProgress();
    progress.begin('Format', 0, '', true);
    for (const [_, service] of host.services) {
        const ls = service.getLanguageServiceDontCreate();
        if (!ls) continue;
        const sourceFiles = ls.getAllSourceFiles();
        let i = 0;
        for (const sourceFile of sourceFiles) {
            if (progress.token.isCancellationRequested) {
                continue;
            }
            const doc = sourceFile.getTextDocument();
            progress.report(i++ / sourceFiles.length * 100, path.relative(ls.rootPath, uriToFsPath(doc.uri)));
            const edits = ls.doFormatting(doc, options) ?? [];
            const workspaceEdit: WorkspaceEdit = { changes: { [doc.uri]: edits } };
            await connection.workspace.applyEdit(workspaceEdit);
        }
    }
    progress.done();
});
connection.onRequest(WriteVirtualFilesRequest.type, async () => {
    if (!host) return;
    const progress = await connection.window.createWorkDoneProgress();
    progress.begin('Write', 0, '', true);
    for (const [_, service] of host.services) {
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

    if (!host) return;

    let errors = 0;
    let warnings = 0;

    const progress = await connection.window.createWorkDoneProgress();
    progress.begin('Verify', 0, '', true);
    for (const [_, service] of host.services) {
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
    return host?.bestMatch(document.uri)?.getSemanticTokens(document, handler.range);
});
connection.onRequest(SemanticTokenLegendRequest.type, () => semanticTokenLegend);
connection.onRequest(TagCloseRequest.type, handler => {
    if (!noStateLs) return;
    const document = documents.get(handler.textDocument.uri);
    if (!document) return;
    return noStateLs.doAutoClose(document, handler.position);
});
