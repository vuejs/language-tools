import * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';
import { languageFeatureWorker } from '../utils/featureWorkers';
import * as dedupe from '../utils/dedupe';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { SourceFileDocuments } from '../documents';
import { PositionCapabilities } from '@volar/language-core';

export function register(context: LanguageServiceRuntimeContext) {

	return (uri: string, position: vscode.Position, newName: string) => {

		let _data: PositionCapabilities | undefined;

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

				await withTeleports(document, arg.position, arg.newName);

				return result;

				async function withTeleports(document: TextDocument, position: vscode.Position, newName: string) {

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

								let foundTeleport = false;

								recursiveChecker.add({ uri: editUri, range: { start: textEdit.range.start, end: textEdit.range.start } });

								const teleport = context.documents.getTeleport(editUri);

								if (teleport) {

									for (const mapped of teleport.findTeleports(textEdit.range.start)) {

										if (!mapped[1].rename)
											continue;

										if (recursiveChecker.has({ uri: teleport.document.uri, range: { start: mapped[0], end: mapped[0] } }))
											continue;

										foundTeleport = true;

										await withTeleports(teleport.document, mapped[0], newName);
									}
								}

								if (!foundTeleport) {

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
	vueDocuments: SourceFileDocuments,
) {

	const vueResult: vscode.WorkspaceEdit = {};
	let hasResult = false;

	for (const tsUri in tsResult.changeAnnotations) {

		if (!vueResult.changeAnnotations)
			vueResult.changeAnnotations = {};

		const tsAnno = tsResult.changeAnnotations[tsUri];
		const uri = vueDocuments.getMap(tsUri)?.sourceDocument.uri ?? tsUri;
		vueResult.changeAnnotations[uri] = tsAnno;
	}
	for (const tsUri in tsResult.changes) {
		if (!vueResult.changes) {
			vueResult.changes = {};
		}
		const map = vueDocuments.getMap(tsUri);
		if (!map) {
			vueResult.changes[tsUri] = tsResult.changes[tsUri];
			hasResult = true;
			continue;
		}
		const tsEdits = tsResult.changes[tsUri];
		for (const tsEdit of tsEdits) {
			let _data: PositionCapabilities | undefined;
			const range = map.toSourceRange(tsEdit.range, data => {
				_data = data;
				return typeof data.rename === 'object' ? !!data.rename.apply : !!data.rename;
			});
			if (range) {
				let newText = tsEdit.newText;
				if (_data && typeof _data.rename === 'object' && _data.rename.apply) {
					newText = _data.rename.apply(tsEdit.newText);
				}
				if (!vueResult.changes[map.sourceDocument.uri]) {
					vueResult.changes[map.sourceDocument.uri] = [];
				}
				vueResult.changes[map.sourceDocument.uri].push({ newText, range });
				hasResult = true;
			}
		}
	}
	if (tsResult.documentChanges) {
		for (const tsDocEdit of tsResult.documentChanges) {
			if (!vueResult.documentChanges) {
				vueResult.documentChanges = [];
			}
			let vueDocEdit: typeof tsDocEdit | undefined;
			if (vscode.TextDocumentEdit.is(tsDocEdit)) {
				const map = vueDocuments.getMap(tsDocEdit.textDocument.uri);
				if (map) {
					vueDocEdit = vscode.TextDocumentEdit.create(
						{
							uri: map.sourceDocument.uri,
							// version: map.sourceDocument.version,
							version: null, // fix https://github.com/johnsoncodehk/volar/issues/1490
						},
						[],
					);
					for (const tsEdit of tsDocEdit.edits) {
						let _data: PositionCapabilities | undefined;
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
							vueDocEdit.edits.push({
								annotationId: vscode.AnnotatedTextEdit.is(tsEdit.range) ? tsEdit.range.annotationId : undefined,
								newText,
								range,
							});
						}
					}
					if (!vueDocEdit.edits.length) {
						vueDocEdit = undefined;
					}
				}
				else {
					vueDocEdit = tsDocEdit;
				}
			}
			else if (vscode.CreateFile.is(tsDocEdit)) {
				vueDocEdit = tsDocEdit; // TODO: remove .ts?
			}
			else if (vscode.RenameFile.is(tsDocEdit)) {
				const oldUri = vueDocuments.getMap(tsDocEdit.oldUri)?.sourceDocument.uri ?? tsDocEdit.oldUri;
				vueDocEdit = vscode.RenameFile.create(oldUri, tsDocEdit.newUri /* TODO: remove .ts? */, tsDocEdit.options, tsDocEdit.annotationId);
			}
			else if (vscode.DeleteFile.is(tsDocEdit)) {
				const uri = vueDocuments.getMap(tsDocEdit.uri)?.sourceDocument.uri ?? tsDocEdit.uri;
				vueDocEdit = vscode.DeleteFile.create(uri, tsDocEdit.options, tsDocEdit.annotationId);
			}
			if (vueDocEdit) {
				vueResult.documentChanges.push(vueDocEdit);
				hasResult = true;
			}
		}
	}
	if (hasResult) {
		return vueResult;
	}
}
