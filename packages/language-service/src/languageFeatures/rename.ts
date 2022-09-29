import * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';
import { languageFeatureWorker } from '../utils/featureWorkers';
import * as dedupe from '../utils/dedupe';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { SourceFileDocuments } from '../documents';

export function register(context: LanguageServiceRuntimeContext) {

	return (uri: string, position: vscode.Position, newName: string) => {

		return languageFeatureWorker(
			context,
			uri,
			{ position, newName },
			function* (arg, sourceMap) {
				for (const mapped of sourceMap.toGeneratedPositions(arg.position)) {

					const shouldRename = typeof mapped[1].data.rename === 'object' ? !!mapped[1].data.rename.normalize : !!mapped[1].data.rename;
					if (!shouldRename)
						continue;

					let newName = arg.newName;

					if (typeof mapped[1].data.rename === 'object' && mapped[1].data.rename.normalize)
						newName = mapped[1].data.rename.normalize(arg.newName);

					yield { position: mapped[0], newName };
				}
			},
			async (plugin, document, arg, sourceMap) => {

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

								const teleport = context.documents.teleportfromEmbeddedDocumentUri(editUri);

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
			(data, sourceMap) => {
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

/**
 * TODO: rewrite this
 *
 * Start from Script LS
 * -> Access all results
 *
 * Start from template LS
 * -> Start from template content?
 *    -> Access all results
 * -> Start from script content?
 *    -> Yes: Only access template results
 *    -> No: Access all results
 */
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
		const uri = vueDocuments.sourceMapFromEmbeddedDocumentUri(tsUri)?.sourceDocument.uri ?? tsUri;
		vueResult.changeAnnotations[uri] = tsAnno;
	}
	for (const tsUri in tsResult.changes) {
		const tsEdits = tsResult.changes[tsUri];
		for (const tsEdit of tsEdits) {
			for (const vueLoc of vueDocuments.fromEmbeddedLocation(tsUri, tsEdit.range.start)) {

				// fix https://github.com/johnsoncodehk/volar/issues/1091
				const shouldRename = !vueLoc.mapping || (typeof vueLoc.mapping.data?.rename === 'object' ? typeof vueLoc.mapping.data.rename.apply : !!vueLoc.mapping.data?.rename);
				if (!shouldRename)
					continue;

				const end = vueLoc.sourceMap ? vueLoc.sourceMap.matchSourcePosition(tsEdit.range.end, vueLoc.mapping, 'right') : tsEdit.range.end;
				if (!end)
					continue;

				let newText_2 = tsEdit.newText;

				if (vueLoc.sourceMap && typeof vueLoc.mapping.data.rename === 'object' && vueLoc.mapping.data.rename.apply) {
					const vueDoc = vueLoc.sourceMap.sourceDocument;
					newText_2 = vueLoc.mapping.data.rename.apply(vueDoc.getText({ start: vueLoc.position, end }), tsEdit.newText);
				}

				if (!vueResult.changes) {
					vueResult.changes = {};
				}

				if (!vueResult.changes[vueLoc.uri]) {
					vueResult.changes[vueLoc.uri] = [];
				}

				vueResult.changes[vueLoc.uri].push({
					newText: newText_2,
					range: { start: vueLoc.position, end },
				});
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
				const sourceMap = vueDocuments.sourceMapFromEmbeddedDocumentUri(tsDocEdit.textDocument.uri);
				if (sourceMap) {
					vueDocEdit = vscode.TextDocumentEdit.create(
						{
							uri: sourceMap.sourceDocument.uri,
							// version: sourceMap.sourceDocument.version,
							version: null, // fix https://github.com/johnsoncodehk/volar/issues/1490
						},
						[],
					);
					for (const tsEdit of tsDocEdit.edits) {
						for (const mapped of sourceMap.toSourcePositions(tsEdit.range.start)) {

							// fix https://github.com/johnsoncodehk/volar/issues/1091
							const shouldApplyRename = typeof mapped[1].data.rename === 'object' ? !!mapped[1].data.rename.apply : !!mapped[1].data.rename;
							if (!shouldApplyRename)
								continue;

							const end = sourceMap.matchSourcePosition(tsEdit.range.end, mapped[1], 'right');
							if (!end)
								continue;

							vueDocEdit.edits.push({
								annotationId: vscode.AnnotatedTextEdit.is(tsEdit.range) ? tsEdit.range.annotationId : undefined,
								newText: tsEdit.newText,
								range: { start: mapped[0], end },
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
				const oldUri = vueDocuments.sourceMapFromEmbeddedDocumentUri(tsDocEdit.oldUri)?.sourceDocument.uri ?? tsDocEdit.oldUri;
				vueDocEdit = vscode.RenameFile.create(oldUri, tsDocEdit.newUri /* TODO: remove .ts? */, tsDocEdit.options, tsDocEdit.annotationId);
			}
			else if (vscode.DeleteFile.is(tsDocEdit)) {
				const uri = vueDocuments.sourceMapFromEmbeddedDocumentUri(tsDocEdit.uri)?.sourceDocument.uri ?? tsDocEdit.uri;
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
