import * as vscode from 'vscode';
import type { BaseLanguageClient } from 'vscode-languageclient';
import { WriteVirtualFilesNotification, GetVirtualFileNamesRequest, GetVirtualFileRequest } from '@volar/vue-language-server';
import { SourceMapBase } from '@volar/source-map';

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
	// use a themable color. See package.json for the declaration and default values.
	backgroundColor: 'darkblue'
});

export async function register(cmd: string, context: vscode.ExtensionContext, client: BaseLanguageClient) {

	const sourceUriToVirtualUris = new Map<string, string[]>();
	const virtualUriToSourceEditor = new Map<string, vscode.TextEditor>();
	const virtualUriToSourceMap = new Map<string, SourceMapBase>();
	const docChangeEvent = new vscode.EventEmitter<vscode.Uri>();

	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(update));
	context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(update));
	context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(e => {
		const uris = sourceUriToVirtualUris.get(e.document.uri.toString());
		if (uris) {
			for (const uri of uris) {
				docChangeEvent.fire(vscode.Uri.parse(uri));
			}
		}
	}));
	context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(
		scheme,
		{
			onDidChange: docChangeEvent.event,
			async provideTextDocumentContent(uri: vscode.Uri): Promise<string | undefined> {

				const fileName = uri.with({ scheme: 'file' }).fsPath;
				const sourceUri = virtualUriToSourceEditor.get(uri.toString());

				if (sourceUri) {

					const virtual = await client.sendRequest(GetVirtualFileRequest.type, { sourceFileUri: sourceUri.document.uri.toString(), virtualFileName: fileName });

					virtualUriToSourceMap.set(uri.toString(), new SourceMapBase(virtual.mappings));

					return virtual.content;
				}
			}
		},
	));
	context.subscriptions.push(vscode.commands.registerCommand('volar.action.showVirtualFiles', async () => {
		const sourceEditor = vscode.window.activeTextEditor;
		if (sourceEditor) {
			const fileNames = await client.sendRequest(GetVirtualFileNamesRequest.type, client.code2ProtocolConverter.asTextDocumentIdentifier(sourceEditor.document));
			const uris = fileNames.map(fileName => vscode.Uri.file(fileName).with({ scheme }));
			sourceUriToVirtualUris.set(sourceEditor.document.uri.toString(), uris.map(uri => uri.toString()));
			for (const uri of uris) {
				virtualUriToSourceEditor.set(uri.toString(), sourceEditor);
				vscode.window.showTextDocument(uri, { viewColumn: vscode.ViewColumn.Two, preview: false });
			}
		}
	}));
	context.subscriptions.push(vscode.commands.registerCommand(cmd, () => {
		if (vscode.window.activeTextEditor) {
			client.sendNotification(WriteVirtualFilesNotification.type, client.code2ProtocolConverter.asTextDocumentIdentifier(vscode.window.activeTextEditor.document));
		}
	}));

	function update() {
		if (vscode.window.activeTextEditor) {
			const sourceEditor = virtualUriToSourceEditor.get(vscode.window.activeTextEditor.document.uri.toString()) ?? vscode.window.activeTextEditor;
			const virtualUris = sourceUriToVirtualUris.get(sourceEditor.document.uri.toString());
			const virtualEditors = vscode.window.visibleTextEditors.filter(editor => virtualUris?.includes(editor.document.uri.toString()));;
			if (virtualEditors) {
				let mappingDecorationRanges: vscode.Range[] = [];
				let mappingSelectionDecorationRanges: vscode.Range[] = [];
				for (const virtualEditor of virtualEditors) {
					const map = virtualUriToSourceMap.get(virtualEditor.document.uri.toString());
					if (map) {
						mappingDecorationRanges = mappingDecorationRanges.concat(map.mappings.map(mapping => new vscode.Range(
							sourceEditor.document.positionAt(mapping.sourceRange[0]),
							sourceEditor.document.positionAt(mapping.sourceRange[1]),
						)));
						virtualEditor.setDecorations(mappingDecorationType, map.mappings.map(mapping => new vscode.Range(
							virtualEditor.document.positionAt(mapping.generatedRange[0]),
							virtualEditor.document.positionAt(mapping.generatedRange[1]),
						)));

						/**
						 * selection
						 */
						const selection = vscode.window.activeTextEditor.selection;
						const startOffset = vscode.window.activeTextEditor.document.offsetAt(selection.start);
						const mappeds = vscode.window.activeTextEditor === sourceEditor
							? [...map.toGeneratedOffsets(startOffset)]
							: [...map.toSourceOffsets(startOffset)];
						for (const mapped of mappeds) {
							mappingSelectionDecorationRanges.push(new vscode.Range(
								sourceEditor.document.positionAt(mapped[1].sourceRange[0]),
								sourceEditor.document.positionAt(mapped[1].sourceRange[1]),
							));
						}
						virtualEditor.setDecorations(mappingSelectionDecorationType, mappeds.map(mapped => new vscode.Range(
							virtualEditor.document.positionAt(mapped[1].generatedRange[0]),
							virtualEditor.document.positionAt(mapped[1].generatedRange[1]),
						)));
						if (mappeds.length) {
							if (vscode.window.activeTextEditor === sourceEditor) {
								const mapped = mappeds.sort((a, b) => a[1].generatedRange[0] - b[1].generatedRange[0])[0];
								virtualEditor.revealRange(new vscode.Range(
									virtualEditor.document.positionAt(mapped[1].generatedRange[0]),
									virtualEditor.document.positionAt(mapped[1].generatedRange[1]),
								));
							}
							else {
								const mapped = mappeds.sort((a, b) => a[1].sourceRange[0] - b[1].sourceRange[0])[0];
								sourceEditor.revealRange(new vscode.Range(
									sourceEditor.document.positionAt(mapped[1].sourceRange[0]),
									sourceEditor.document.positionAt(mapped[1].sourceRange[1]),
								));
							}
						}
					}
				}
				sourceEditor.setDecorations(mappingDecorationType, mappingDecorationRanges);
				sourceEditor.setDecorations(mappingSelectionDecorationType, mappingSelectionDecorationRanges);
			}
		}
	}
}
