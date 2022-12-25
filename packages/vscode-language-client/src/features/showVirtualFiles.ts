import * as vscode from 'vscode';
import type { BaseLanguageClient } from 'vscode-languageclient';
import { GetVirtualFileNamesRequest, GetVirtualFileRequest } from '@volar/language-server';
import { SourceMap } from '@volar/source-map';
import type { FileRangeCapabilities } from '@volar/language-core';

const scheme = 'volar-virtual-file';
const mappingDecorationType = vscode.window.createTextEditorDecorationType({
	borderWidth: '1px',
	borderStyle: 'solid',
	overviewRulerColor: 'blue',
	overviewRulerLane: vscode.OverviewRulerLane.Right,
	light: {
		// this color will be used in light color themes
		borderColor: 'darkblue'
	},
	dark: {
		// this color will be used in dark color themes
		borderColor: 'lightblue'
	}
});
const mappingSelectionDecorationType = vscode.window.createTextEditorDecorationType({
	cursor: 'crosshair',
	light: {
		backgroundColor: 'lightblue'
	},
	dark: {
		backgroundColor: 'darkblue'
	}
});

export async function register(cmd: string, context: vscode.ExtensionContext, client: BaseLanguageClient) {

	class MappingDataHoverProvider implements vscode.HoverProvider {
		async provideHover(document: vscode.TextDocument, position: vscode.Position, _token: vscode.CancellationToken) {

			const maps = virtualUriToSourceMap.get(document.uri.toString());
			if (!maps) return;

			const data: [string, FileRangeCapabilities][] = [];

			for (const [sourceUri, _, map] of maps) {
				const source = map.toSourceOffset(document.offsetAt(position));
				if (source) {
					data.push([sourceUri, source[1].data]);
				}
			}

			if (data.length === 0) return;

			return new vscode.Hover(data.map(([uri, data]) => [
				uri,
				'```json',
				JSON.stringify(data, null, 2),
				'```',
			].join('\n')));
		}
	}

	vscode.languages.registerHoverProvider({ scheme }, new MappingDataHoverProvider());

	const sourceUriToVirtualUris = new Map<string, Set<string>>();
	const virtualUriToSourceEditor = new Map<string, vscode.TextEditor>();
	const virtualUriToSourceMap = new Map<string, [string, number, SourceMap<FileRangeCapabilities>][]>();
	const docChangeEvent = new vscode.EventEmitter<vscode.Uri>();

	let updateVirtualDocument: NodeJS.Timeout | undefined;
	let updateDecorationsTimeout: NodeJS.Timeout | undefined;

	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(updateDecorations));
	context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(updateDecorations));
	context.subscriptions.push(vscode.window.onDidChangeVisibleTextEditors(updateDecorations));
	context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(e => {
		if (sourceUriToVirtualUris.has(e.document.uri.toString())) {
			const virtualUris = sourceUriToVirtualUris.get(e.document.uri.toString());
			clearTimeout(updateVirtualDocument);
			updateVirtualDocument = setTimeout(() => {
				virtualUris?.forEach(uri => {
					docChangeEvent.fire(vscode.Uri.parse(uri));
				});
			}, 100);
		}
	}));
	context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(
		scheme,
		{
			onDidChange: docChangeEvent.event,
			async provideTextDocumentContent(uri: vscode.Uri): Promise<string | undefined> {

				const fileName = uri.with({ scheme: 'file' }).fsPath;
				const requestEditor = virtualUriToSourceEditor.get(uri.toString());

				if (requestEditor) {

					const virtual = await client.sendRequest(GetVirtualFileRequest.type, { sourceFileUri: requestEditor.document.uri.toString(), virtualFileName: fileName });
					virtualUriToSourceMap.set(uri.toString(), []);

					Object.entries(virtual.mappings).forEach(([sourceUri, mappings]) => {
						const sourceEditor = vscode.window.visibleTextEditors.find(editor => editor.document.uri.toString() === sourceUri);
						if (sourceEditor) {
							virtualUriToSourceMap.get(uri.toString())?.push([
								sourceEditor.document.uri.toString(),
								sourceEditor.document.version,
								new SourceMap(mappings),
							]);
							if (!sourceUriToVirtualUris.has(sourceUri)) {
								sourceUriToVirtualUris.set(sourceUri, new Set());
							}
							sourceUriToVirtualUris.get(sourceUri)?.add(uri.toString());
						}
					});

					clearTimeout(updateDecorationsTimeout);
					updateDecorationsTimeout = setTimeout(updateDecorations, 100);

					return virtual.content;
				}
			}
		},
	));
	context.subscriptions.push(vscode.commands.registerCommand(cmd, async () => {
		const sourceEditor = vscode.window.activeTextEditor;
		if (sourceEditor) {
			const fileNames = await client.sendRequest(GetVirtualFileNamesRequest.type, client.code2ProtocolConverter.asTextDocumentIdentifier(sourceEditor.document));
			const uris = fileNames.map(fileName => vscode.Uri.file(fileName).with({ scheme }));
			sourceUriToVirtualUris.set(sourceEditor.document.uri.toString(), new Set(uris.map(uri => uri.toString())));
			for (const uri of uris) {
				virtualUriToSourceEditor.set(uri.toString(), sourceEditor);
				vscode.window.showTextDocument(uri, { viewColumn: vscode.ViewColumn.Two, preview: false });
			}
		}
	}));

	function updateDecorations() {
		for (const [virtualUri, sources] of virtualUriToSourceMap) {

			const virtualEditor = vscode.window.visibleTextEditors.find(editor => editor.document.uri.toString() === virtualUri);
			let virtualRanges1: vscode.Range[] = [];
			let virtualRanges2: vscode.Range[] = [];

			if (virtualEditor) {
				for (const [sourceUri, sourceVersion, map] of sources) {
					const sourceEditor = vscode.window.visibleTextEditors.find(editor => editor.document.uri.toString() === sourceUri);
					if (sourceEditor && sourceEditor.document.version === sourceVersion) {
						const mappingDecorationRanges = map.mappings.map(mapping => new vscode.Range(
							sourceEditor.document.positionAt(mapping.sourceRange[0]),
							sourceEditor.document.positionAt(mapping.sourceRange[1]),
						));
						sourceEditor.setDecorations(mappingDecorationType, mappingDecorationRanges);
						virtualRanges1 = virtualRanges1.concat(map.mappings.map(mapping => new vscode.Range(
							virtualEditor.document.positionAt(mapping.generatedRange[0]),
							virtualEditor.document.positionAt(mapping.generatedRange[1]),
						)));

						/**
						 * selection
						 */
						if (vscode.window.activeTextEditor) {
							const selection = vscode.window.activeTextEditor.selection;
							const startOffset = vscode.window.activeTextEditor.document.offsetAt(selection.start);
							sourceEditor.setDecorations(mappingSelectionDecorationType, []);
							if (vscode.window.activeTextEditor === sourceEditor) {
								const matchVirtualRanges = [...map.toGeneratedOffsets(startOffset)];
								sourceEditor.setDecorations(mappingSelectionDecorationType, matchVirtualRanges.map(mapped => new vscode.Range(
									sourceEditor.document.positionAt(mapped[1].sourceRange[0]),
									sourceEditor.document.positionAt(mapped[1].sourceRange[1]),
								)));
								virtualRanges2 = virtualRanges2.concat(matchVirtualRanges.map(mapped => new vscode.Range(
									virtualEditor.document.positionAt(mapped[1].generatedRange[0]),
									virtualEditor.document.positionAt(mapped[1].generatedRange[1]),
								)));
								const mapped = matchVirtualRanges.sort((a, b) => a[1].generatedRange[0] - b[1].generatedRange[0])[0];
								if (mapped) {
									virtualEditor.revealRange(new vscode.Range(
										virtualEditor.document.positionAt(mapped[1].generatedRange[0]),
										virtualEditor.document.positionAt(mapped[1].generatedRange[1]),
									));
								}
							}
							else if (vscode.window.activeTextEditor === virtualEditor) {
								const matchSourceRanges = [...map.toSourceOffsets(startOffset)];
								sourceEditor.setDecorations(mappingSelectionDecorationType, matchSourceRanges.map(mapped => new vscode.Range(
									sourceEditor.document.positionAt(mapped[1].sourceRange[0]),
									sourceEditor.document.positionAt(mapped[1].sourceRange[1]),
								)));
								virtualRanges2 = virtualRanges2.concat(matchSourceRanges.map(mapped => new vscode.Range(
									virtualEditor.document.positionAt(mapped[1].generatedRange[0]),
									virtualEditor.document.positionAt(mapped[1].generatedRange[1]),
								)));
								const mapped = matchSourceRanges.sort((a, b) => a[1].sourceRange[0] - b[1].sourceRange[0])[0];
								if (mapped) {
									sourceEditor.revealRange(new vscode.Range(
										sourceEditor.document.positionAt(mapped[1].sourceRange[0]),
										sourceEditor.document.positionAt(mapped[1].sourceRange[1]),
									));
								}
							}
						}
						else {
							sourceEditor.setDecorations(mappingSelectionDecorationType, []);
						}
					}
				}
				virtualEditor.setDecorations(mappingDecorationType, virtualRanges1);
				virtualEditor.setDecorations(mappingSelectionDecorationType, virtualRanges2);
			}
			else {
				for (const [sourceUri] of sources) {
					const sourceEditor = vscode.window.visibleTextEditors.find(editor => editor.document.uri.toString() === sourceUri);
					if (sourceEditor) {
						sourceEditor.setDecorations(mappingDecorationType, []);
						sourceEditor.setDecorations(mappingSelectionDecorationType, []);
					}
				}
			}
		}
	}
}
