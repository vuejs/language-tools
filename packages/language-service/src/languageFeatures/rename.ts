import * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';
import { languageFeatureWorker } from '../utils/featureWorkers';
import * as dedupe from '../utils/dedupe';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DocumentsAndSourceMaps } from '../documents';
import { FileRangeCapabilities } from '@volar/language-core';

export function register(context: LanguageServiceRuntimeContext) {

	return (uri: string, position: vscode.Position, newName: string) => {

		let _data: FileRangeCapabilities | undefined;

		return languageFeatureWorker(
			context,
			uri,
			{ position, newName },
			function* (arg, map) {
				for (const mapped of map.toGeneratedPositions(arg.position, data => {
					_data = data;
					return typeof data.rename === 'object' ? !!data.rename.normalize : !!data.rename;
				})) {

					let newName = arg.newName;

					if (_data && typeof _data.rename === 'object' && _data.rename.normalize) {
						newName = _data.rename.normalize(arg.newName);
					}

					yield { position: mapped, newName };
				};
			},
			async (plugin, document, arg) => {

				const recursiveChecker = dedupe.createLocationSet();
				let result: vscode.WorkspaceEdit | undefined;

				await withMirrors(document, arg.position, arg.newName);

				return result;

				async function withMirrors(document: TextDocument, position: vscode.Position, newName: string) {

					if (!plugin.rename?.on)
						return;

					if (recursiveChecker.has({ uri: document.uri, range: { start: position, end: position } }))
						return;

					recursiveChecker.add({ uri: document.uri, range: { start: position, end: position } });

					const workspaceEdit = await plugin.rename.on(document, position, newName);

					if (!workspaceEdit)
						return;

					if (!result)
						result = {};

					if (workspaceEdit.changes) {

						for (const editUri in workspaceEdit.changes) {

							const textEdits = workspaceEdit.changes[editUri];

							for (const textEdit of textEdits) {

								let foundMirrorPosition = false;

								recursiveChecker.add({ uri: editUri, range: { start: textEdit.range.start, end: textEdit.range.start } });

								const mirrorMap = context.documents.getMirrorMapByUri(editUri)?.[1];

								if (mirrorMap) {

									for (const mapped of mirrorMap.findMirrorPositions(textEdit.range.start)) {

										if (!mapped[1].rename)
											continue;

										if (recursiveChecker.has({ uri: mirrorMap.document.uri, range: { start: mapped[0], end: mapped[0] } }))
											continue;

										foundMirrorPosition = true;

										await withMirrors(mirrorMap.document, mapped[0], newName);
									}
								}

								if (!foundMirrorPosition) {

									if (!result.changes)
										result.changes = {};

									if (!result.changes[editUri])
										result.changes[editUri] = [];

									result.changes[editUri].push(textEdit);
								}
							}
						}
					}

					if (workspaceEdit.changeAnnotations) {

						for (const uri in workspaceEdit.changeAnnotations) {

							if (!result.changeAnnotations)
								result.changeAnnotations = {};

							result.changeAnnotations[uri] = workspaceEdit.changeAnnotations[uri];
						}
					}

					if (workspaceEdit.documentChanges) {

						if (!result.documentChanges)
							result.documentChanges = [];

						result.documentChanges = result.documentChanges.concat(workspaceEdit.documentChanges);
					}
				}
			},
			(data) => {
				return embeddedEditToSourceEdit(
					data,
					context.documents,
				);
			},
			(workspaceEdits) => {

				const mainEdit = workspaceEdits[0];
				const otherEdits = workspaceEdits.slice(1);

				mergeWorkspaceEdits(mainEdit, ...otherEdits);

				if (mainEdit.changes) {
					for (const uri in mainEdit.changes) {
						mainEdit.changes[uri] = dedupe.withTextEdits(mainEdit.changes[uri]);
					}
				}

				return workspaceEdits[0];
			},
		);
	};
}

export function mergeWorkspaceEdits(original: vscode.WorkspaceEdit, ...others: vscode.WorkspaceEdit[]) {
	for (const other of others) {
		for (const uri in other.changeAnnotations) {
			if (!original.changeAnnotations) {
				original.changeAnnotations = {};
			}
			original.changeAnnotations[uri] = other.changeAnnotations[uri];
		}
		for (const uri in other.changes) {
			if (!original.changes) {
				original.changes = {};
			}
			if (!original.changes[uri]) {
				original.changes[uri] = [];
			}
			const edits = other.changes[uri];
			original.changes[uri] = original.changes[uri].concat(edits);
		}
		if (other.documentChanges) {
			if (!original.documentChanges) {
				original.documentChanges = [];
			}
			for (const docChange of other.documentChanges) {
				original.documentChanges.push(docChange);
			}
		}
	}
}

export function embeddedEditToSourceEdit(
	tsResult: vscode.WorkspaceEdit,
	vueDocuments: DocumentsAndSourceMaps,
) {

	const sourceResult: vscode.WorkspaceEdit = {};
	let hasResult = false;

	for (const tsUri in tsResult.changeAnnotations) {

		sourceResult.changeAnnotations ??= {};

		const tsAnno = tsResult.changeAnnotations[tsUri];

		if (!vueDocuments.getVirtualFileByUri(tsUri)) {
			sourceResult.changeAnnotations[tsUri] = tsAnno;
		}
		else {
			for (const [_, map] of vueDocuments.getMapsByVirtualFileUri(tsUri)) {
				// TODO: check capability?
				const uri = map.sourceFileDocument.uri;
				sourceResult.changeAnnotations[uri] = tsAnno;
			}
		}
	}
	for (const tsUri in tsResult.changes) {

		sourceResult.changes ??= {};

		if (!vueDocuments.getVirtualFileByUri(tsUri)) {
			sourceResult.changes[tsUri] = tsResult.changes[tsUri];
			hasResult = true;
			continue;
		}
		for (const [_, map] of vueDocuments.getMapsByVirtualFileUri(tsUri)) {
			const tsEdits = tsResult.changes[tsUri];
			for (const tsEdit of tsEdits) {
				let _data: FileRangeCapabilities | undefined;
				const range = map.toSourceRange(tsEdit.range, data => {
					_data = data;
					return typeof data.rename === 'object' ? !!data.rename.apply : !!data.rename;
				});
				if (range) {
					let newText = tsEdit.newText;
					if (_data && typeof _data.rename === 'object' && _data.rename.apply) {
						newText = _data.rename.apply(tsEdit.newText);
					}
					if (!sourceResult.changes[map.sourceFileDocument.uri]) {
						sourceResult.changes[map.sourceFileDocument.uri] = [];
					}
					sourceResult.changes[map.sourceFileDocument.uri].push({ newText, range });
					hasResult = true;
				}
			}
		}
	}
	if (tsResult.documentChanges) {
		for (const tsDocEdit of tsResult.documentChanges) {

			sourceResult.documentChanges ??= [];

			let sourceEdit: typeof tsDocEdit | undefined;
			if (vscode.TextDocumentEdit.is(tsDocEdit)) {
				if (vueDocuments.getVirtualFileByUri(tsDocEdit.textDocument.uri)) {
					for (const [_, map] of vueDocuments.getMapsByVirtualFileUri(tsDocEdit.textDocument.uri)) {
						sourceEdit = vscode.TextDocumentEdit.create(
							{
								uri: map.sourceFileDocument.uri,
								// version: map.sourceDocument.version,
								version: null, // fix https://github.com/johnsoncodehk/volar/issues/1490
							},
							[],
						);
						for (const tsEdit of tsDocEdit.edits) {
							let _data: FileRangeCapabilities | undefined;
							const range = map.toSourceRange(tsEdit.range, data => {
								_data = data;
								// fix https://github.com/johnsoncodehk/volar/issues/1091
								return typeof data.rename === 'object' ? !!data.rename.apply : !!data.rename;
							});
							if (range) {
								let newText = tsEdit.newText;
								if (_data && typeof _data.rename === 'object' && _data.rename.apply) {
									newText = _data.rename.apply(tsEdit.newText);
								}
								sourceEdit.edits.push({
									annotationId: vscode.AnnotatedTextEdit.is(tsEdit.range) ? tsEdit.range.annotationId : undefined,
									newText,
									range,
								});
							}
						}
						if (!sourceEdit.edits.length) {
							sourceEdit = undefined;
						}
					}
				}
				else {
					sourceEdit = tsDocEdit;
				}
			}
			else if (vscode.CreateFile.is(tsDocEdit)) {
				sourceEdit = tsDocEdit; // TODO: remove .ts?
			}
			else if (vscode.RenameFile.is(tsDocEdit)) {
				if (!vueDocuments.getVirtualFileByUri(tsDocEdit.oldUri)) {
					sourceEdit = tsDocEdit;
				}
				else {
					for (const [_, map] of vueDocuments.getMapsByVirtualFileUri(tsDocEdit.oldUri)) {
						// TODO: check capability?
						sourceEdit = vscode.RenameFile.create(map.sourceFileDocument.uri, tsDocEdit.newUri /* TODO: remove .ts? */, tsDocEdit.options, tsDocEdit.annotationId);
					}
				}
			}
			else if (vscode.DeleteFile.is(tsDocEdit)) {
				if (!vueDocuments.getVirtualFileByUri(tsDocEdit.uri)) {
					sourceEdit = tsDocEdit;
				}
				else {
					for (const [_, map] of vueDocuments.getMapsByVirtualFileUri(tsDocEdit.uri)) {
						// TODO: check capability?
						sourceEdit = vscode.DeleteFile.create(map.sourceFileDocument.uri, tsDocEdit.options, tsDocEdit.annotationId);
					}
				}
			}
			if (sourceEdit) {
				sourceResult.documentChanges.push(sourceEdit);
				hasResult = true;
			}
		}
	}
	if (hasResult) {
		return sourceResult;
	}
}
