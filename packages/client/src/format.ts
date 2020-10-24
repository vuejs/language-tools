import * as path from 'upath';
import * as vscode from 'vscode';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
    LanguageClient,
    DocumentFormattingRequest,
} from 'vscode-languageclient';
import {
    GetFormattingSourceMapsRequest,
    languageIdToExtName,
    randomStr,
    ISourceMap,
} from '@volar/shared';

let currentFormatterSetting: string | undefined;
let currentFormatter: vscode.Disposable | undefined;

export async function registerDocumentFormattingEditProvider(client: LanguageClient) {

    class DefaultFormattingProvider implements vscode.DocumentFormattingEditProvider {
        async provideDocumentFormattingEdits(document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken) {
            await client.onReady();
            const result = await client.sendRequest(DocumentFormattingRequest.type, {
                textDocument: client.code2ProtocolConverter.asTextDocumentIdentifier(document),
                options,
            });
            if (!result) return;
            return result.map(edit => new vscode.TextEdit(
                new vscode.Range(
                    new vscode.Position(edit.range.start.line, edit.range.start.character),
                    new vscode.Position(edit.range.end.line, edit.range.end.character),
                ),
                edit.newText,
            ));
        }
    }
    class WorkspaceExtensionsFormattingProvider implements vscode.DocumentFormattingEditProvider {

        startupFormatters = new Set<string>();

        async provideDocumentFormattingEdits(document: vscode.TextDocument, options: vscode.FormattingOptions, token: vscode.CancellationToken) {
            await client.onReady();

            const sourceMaps = await client.sendRequest(GetFormattingSourceMapsRequest.type, {
                textDocument: client.code2ProtocolConverter.asTextDocumentIdentifier(document),
            });
            if (!sourceMaps) return;
            if (token.isCancellationRequested) return;

            const languageIds = [...sourceMaps.templates, ...sourceMaps.scripts, ...sourceMaps.styles].map(s => s.languageId);
            for (const languageId of languageIds) {
                if (!this.startupFormatters.has(languageId)) {
                    this.startupFormatters.add(languageId);
                    await tryFormatter(languageId);
                }
                if (token.isCancellationRequested) return;
            }

            const edits = await Promise.all([
                ...sourceMaps.templates.map(s => getWorkspaceEdit(s, sourceMaps.scripts)),
                ...sourceMaps.scripts.map(s => getWorkspaceEdit(s, [])),
                ...sourceMaps.styles.map(s => getWorkspaceEdit(s, [])),
            ]);

            return edits.flat();

            async function getWorkspaceEdit(sourceMap: ISourceMap, ignoreSourceMaps: ISourceMap[]) {
                const result: vscode.TextEdit[] = [];
                if (sourceMap.languageId === 'html') {
                    const edits = await getEdits('html', document.getText(), sourceMap.vueRegion);
                    if (edits) {
                        for (const edit of edits) {
                            const vueRange = {
                                start: document.offsetAt(edit.range.start),
                                end: document.offsetAt(edit.range.end),
                            };
                            if (findMapedByVueRange(vueRange, ignoreSourceMaps)) {
                                continue;
                            }
                            const maped = findMapedByVueRange(vueRange, [sourceMap]);
                            if (maped) {
                                result.push(edit);
                            }
                        }
                    }
                }
                else {
                    const virtualDoc = TextDocument.create('', '', 0, sourceMap.content);
                    const edits = await getEdits(sourceMap.languageId, sourceMap.content, sourceMap.vueRegion);
                    if (edits) {
                        for (const edit of edits) {
                            const virtualRange = {
                                start: virtualDoc.offsetAt(edit.range.start),
                                end: virtualDoc.offsetAt(edit.range.end),
                            };
                            if (virtualRange.start === 0 && !edit.newText.startsWith('\n')) {
                                edit.newText = '\n' + edit.newText;
                            }
                            if (virtualRange.end === sourceMap.content.length && !edit.newText.endsWith('\n')) {
                                edit.newText = edit.newText + '\n';
                            }
                            const maped = findMapedByVirtualRange(virtualRange, [sourceMap]);
                            if (maped) {
                                const vueOffsetRange = {
                                    start: virtualRange.start - maped.virtualRange.start + maped.vueRange.start,
                                    end: virtualRange.end - maped.virtualRange.end + maped.vueRange.end,
                                };
                                if (findMapedByVueRange(vueOffsetRange, ignoreSourceMaps)) {
                                    continue;
                                }
                                const vueRange = new vscode.Range(
                                    document.positionAt(vueOffsetRange.start),
                                    document.positionAt(vueOffsetRange.end),
                                );
                                edit.range = vueRange;
                                result.push(edit);
                            }
                        }
                    }
                }
                return result;
                function findMapedByVueRange(vueRange: { start: number, end: number }, sourceMaps: ISourceMap[]) {
                    for (const sourceMap of sourceMaps) {
                        for (const maped of sourceMap.mappings) {
                            if (vueRange.start >= maped.vueRange.start && vueRange.end <= maped.vueRange.end) {
                                return maped;
                            }
                        }
                    }
                }
                function findMapedByVirtualRange(virtualRange: { start: number, end: number }, sourceMaps: ISourceMap[]) {
                    for (const sourceMap of sourceMaps) {
                        for (const maped of sourceMap.mappings) {
                            if (virtualRange.start >= maped.virtualRange.start && virtualRange.end <= maped.virtualRange.end) {
                                return maped;
                            }
                        }
                    }
                }
            }
            async function getEdits(languageId: string, content: string, vueRegion: string) {
                const lang = languageIdToExtName(languageId);
                const tempUri = vscode.Uri.file(path.join(path.dirname(document.uri.fsPath), randomStr() + '.' + path.basename(document.uri.fsPath) + '.' + vueRegion + '.' + lang));
                await vscode.workspace.fs.writeFile(tempUri, Buffer.from(content));
                await vscode.workspace.openTextDocument(tempUri);
                const result = await vscode.commands.executeCommand<vscode.TextEdit[] | undefined>(
                    'vscode.executeFormatDocumentProvider',
                    tempUri,
                    options,
                );
                await vscode.workspace.fs.delete(tempUri);
                return result;
            }
            async function tryFormatter(languageId: string) {
                const lang = languageIdToExtName(languageId);
                const tempUri = vscode.Uri.file(path.join(path.dirname(document.uri.fsPath), randomStr() + '.' + lang));
                await vscode.workspace.fs.writeFile(tempUri, Buffer.from(''));
                const tempDoc = await vscode.workspace.openTextDocument(tempUri);
                await vscode.window.showTextDocument(tempDoc, vscode.ViewColumn.Two);
                // startup formatter
                await vscode.commands.executeCommand<vscode.TextEdit[] | undefined>(
                    'vscode.executeFormatDocumentProvider',
                    tempUri,
                    options,
                );
                // show install formatter if have not (should try start formatter first)
                await vscode.commands.executeCommand('editor.action.formatDocument.none');
                await vscode.window.showTextDocument(tempDoc, vscode.ViewColumn.Two);
                await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
                await vscode.workspace.fs.delete(tempUri);
            }
        }
    }

    vscode.workspace.onDidChangeConfiguration(onUpdate);

    onUpdate();

    function onUpdate() {
        const formatter = vscode.workspace.getConfiguration().get<string>('volar.format.formatter');
        if (currentFormatterSetting === formatter)
            return;
        currentFormatterSetting = formatter;

        if (currentFormatter) {
            currentFormatter.dispose();
            currentFormatter = undefined;
        }
        if (formatter === 'default') {
            currentFormatter = vscode.languages.registerDocumentFormattingEditProvider([{ scheme: 'file', language: 'vue' }], new DefaultFormattingProvider());
        }
        if (formatter === 'workspaceExtensions') {
            currentFormatter = vscode.languages.registerDocumentFormattingEditProvider([{ scheme: 'file', language: 'vue' }], new WorkspaceExtensionsFormattingProvider());
        }
    }
}
