import * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';
import { languageFeatureWorker } from '../utils/featureWorkers';
import * as dedupe from '../utils/dedupe';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { SourceFileDocuments } from '../vueDocuments';

export function register(context: LanguageServiceRuntimeContext) {

	return (uri: string, position: vscode.Position, newName: string) => {

		return languageFeatureWorker(
			context,
			uri,
			{ position, newName },
			function* (arg, sourceMap) {
				for (const [mappedRange, mappedData] of sourceMap.getMappedRanges(
					arg.position,
					arg.position,
					data => typeof data.capabilities.rename === 'object' ? data.capabilities.rename.in : !!data.capabilities.rename,
				)) {

					let newName = arg.newName;

					if (mappedData.normalizeNewName)
						newName = mappedData.normalizeNewName(arg.newName);

					yield { position: mappedRange.start, newName };
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

								const teleport = context.vueDocuments.teleportfromEmbeddedDocumentUri(editUri);

								if (teleport) {

									for (const [teleRange] of teleport.findTeleports(
										textEdit.range.start,
										textEdit.range.end,
										sideData => !!sideData.capabilities.rename,
									)) {

										if (recursiveChecker.has({ uri: teleport.document.uri, range: { start: teleRange.start, end: teleRange.start } }))
											continue;

										foundTeleport = true;

										await withTeleports(teleport.document, teleRange.start, newName);
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
					context.vueDocuments,
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
			for (const vueLoc of vueDocuments.fromEmbeddedLocation(
				tsUri,
				tsEdit.range.start,
				tsEdit.range.end,
				data => typeof data.capabilities.rename === 'object' ? data.capabilities.rename.out : !!data.capabilities.rename, // fix https://github.com/johnsoncodehk/volar/issues/1091
			)) {

				let newText_2 = tsEdit.newText;

				if (vueLoc.sourceMap && vueLoc.data.applyNewName) {
					const vueDoc = vueLoc.sourceMap.sourceDocument;
					newText_2 = vueLoc.data.applyNewName(vueDoc.getText(vueLoc.range), tsEdit.newText);
				}

				if (!vueResult.changes) {
					vueResult.changes = {};
				}

				if (!vueResult.changes[vueLoc.uri]) {
					vueResult.changes[vueLoc.uri] = [];
				}

				vueResult.changes[vueLoc.uri].push({
					newText: newText_2,
					range: vueLoc.range,
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
						for (const [vueRange] of sourceMap.getSourceRanges(
							tsEdit.range.start,
							tsEdit.range.end,
							data => typeof data.capabilities.rename === 'object' ? data.capabilities.rename.out : !!data.capabilities.rename, // fix https://github.com/johnsoncodehk/volar/issues/1091
						)) {

							vueDocEdit.edits.push({
								annotationId: vscode.AnnotatedTextEdit.is(tsEdit.range) ? tsEdit.range.annotationId : undefined,
								newText: tsEdit.newText,
								range: vueRange,
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
