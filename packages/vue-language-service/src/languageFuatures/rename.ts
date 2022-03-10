import * as vscode from 'vscode-languageserver-protocol';
import type { LanguageServiceRuntimeContext } from '../types';
import { languageFeatureWorker } from '../utils/featureWorkers';
import * as dedupe from '../utils/dedupe';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { EmbeddedDocumentMappingData, VueDocuments } from '@volar/vue-typescript';

export function register(context: LanguageServiceRuntimeContext) {

	return (uri: string, position: vscode.Position, newName: string) => {

		return languageFeatureWorker(
			context,
			uri,
			{ position, newName },
			function* (arg, sourceMap) {
				for (const [mapedRange, mapedData] of sourceMap.getMappedRanges(
					arg.position,
					arg.position,
					data => typeof data.capabilities.rename === 'object' ? data.capabilities.rename.in : !!data.capabilities.rename,
				)) {

					let newName = arg.newName;

					if (mapedData.normalizeNewName)
						newName = mapedData.normalizeNewName(arg.newName);

					yield { position: mapedRange.start, newName };
				}
			},
			async (plugin, document, arg, sourceMap) => {

				const recursiveChecker = dedupe.createLocationSet();
				let result: vscode.WorkspaceEdit | undefined;

				await withTeleports(document, arg.position, arg.newName);

				return result;

				async function withTeleports(document: TextDocument, position: vscode.Position, newName: string) {

					if (!plugin.doRename)
						return;

					if (recursiveChecker.has({ uri: document.uri, range: { start: position, end: position } }))
						return;

					recursiveChecker.add({ uri: document.uri, range: { start: position, end: position } });

					const workspaceEdit = await plugin.doRename(document, position, newName);

					if (!workspaceEdit)
						return;

					if (!result)
						result = {};

					if (workspaceEdit.changes) {

						for (const editUri in workspaceEdit.changes) {

							const textEdits = workspaceEdit.changes[editUri];

							for (const textEdit of textEdits) {

								let foundTeleport = false;

								if (sourceMap?.lsType !== 'nonTs') {

									recursiveChecker.add({ uri: editUri, range: { start: textEdit.range.start, end: textEdit.range.start } });

									const teleport = context.vueDocuments.getTsTeleports(sourceMap?.lsType ?? 'script').get(editUri);

									if (teleport) {

										for (const [teleRange, sideData] of teleport.findTeleports(
											textEdit.range.start,
											textEdit.range.end,
											sideData => !!sideData.capabilities.references,
										)) {

											if (recursiveChecker.has({ uri: teleport.document.uri, range: { start: teleRange.start, end: teleRange.start } }))
												continue;

											foundTeleport = true;

											const newName_2 = sideData.transformNewName
												? sideData.transformNewName(newName)
												: newName;

											await withTeleports(teleport.document, teleRange.start, newName_2);
										}
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

				const vueDocument = context.vueDocuments.get(uri);
				const renameFromScriptContent = !vueDocument || !vueDocument.getSourceMaps().some(sourceMap => sourceMap.lsType === 'template' && sourceMap.getMappedRange(position));

				return embeddedEditToSourceEdit(
					sourceMap?.lsType ?? 'script',
					sourceMap?.lsType === 'template' && renameFromScriptContent,
					data,
					context.vueDocuments,
					data => typeof data.capabilities.rename === 'object' ? data.capabilities.rename.out : !!data.capabilities.rename,
				);
			},
			(workspaceEdits) => {

				const mainEdit = workspaceEdits[0];
				const otherEdits = workspaceEdits.slice(1);

				margeWorkspaceEdits(mainEdit, ...otherEdits);

				if (mainEdit.changes) {
					for (const uri in mainEdit.changes) {
						mainEdit.changes[uri] = dedupe.withTextEdits(mainEdit.changes[uri]);
					}
				}

				return workspaceEdits[0];
			},
		);
	}
}

export function margeWorkspaceEdits(original: vscode.WorkspaceEdit, ...others: vscode.WorkspaceEdit[]) {
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
	lsType: 'script' | 'template' | 'nonTs',
	ignoreScriptLsResult: boolean,
	tsResult: vscode.WorkspaceEdit,
	sourceFiles: VueDocuments,
	isValidMapping: (data: EmbeddedDocumentMappingData) => boolean,
) {

	const vueResult: vscode.WorkspaceEdit = {};
	let hasResult = false;

	for (const tsUri in tsResult.changeAnnotations) {

		if (!vueResult.changeAnnotations)
			vueResult.changeAnnotations = {};

		const tsAnno = tsResult.changeAnnotations[tsUri];
		const uri = sourceFiles.fromEmbeddedDocumentUri(lsType, tsUri)?.sourceDocument.uri ?? tsUri;
		vueResult.changeAnnotations[uri] = tsAnno;
	}
	for (const tsUri in tsResult.changes) {
		const tsEdits = tsResult.changes[tsUri];
		for (const tsEdit of tsEdits) {
			for (const vueLoc of sourceFiles.fromEmbeddedLocation(
				lsType,
				tsUri,
				tsEdit.range.start,
				tsEdit.range.end,
				isValidMapping,
			)) {

				if (ignoreScriptLsResult) {
					const isTemplateResult = vueLoc.type === 'embedded-ts' && (vueLoc.data.vueTag === 'template' || vueLoc.data.vueTag === 'style');
					if (!isTemplateResult) {
						continue;
					}
				}

				let newText_2 = tsEdit.newText;

				if (vueLoc.type === 'embedded-ts' && vueLoc.data.applyNewName) {
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
				const sourceMap = sourceFiles.fromEmbeddedDocumentUri(lsType, tsDocEdit.textDocument.uri);
				if (sourceMap) {
					vueDocEdit = vscode.TextDocumentEdit.create(
						{ uri: sourceMap.sourceDocument.uri, version: sourceMap.sourceDocument.version },
						[],
					);
					for (const tsEdit of tsDocEdit.edits) {
						for (const [vueRange, data] of sourceMap.getSourceRanges(tsEdit.range.start, tsEdit.range.end, isValidMapping)) {

							if (ignoreScriptLsResult && !(data.vueTag === 'template' || data.vueTag === 'style')) {
								continue;
							}

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
				else if (!ignoreScriptLsResult) {
					vueDocEdit = tsDocEdit;
				}
			}
			else if (vscode.CreateFile.is(tsDocEdit) && !ignoreScriptLsResult) {
				vueDocEdit = tsDocEdit; // TODO: remove .ts?
			}
			else if (vscode.RenameFile.is(tsDocEdit) && !ignoreScriptLsResult) {
				const oldUri = sourceFiles.fromEmbeddedDocumentUri(lsType, tsDocEdit.oldUri)?.sourceDocument.uri ?? tsDocEdit.oldUri;
				vueDocEdit = vscode.RenameFile.create(oldUri, tsDocEdit.newUri /* TODO: remove .ts? */, tsDocEdit.options, tsDocEdit.annotationId);
			}
			else if (vscode.DeleteFile.is(tsDocEdit) && !ignoreScriptLsResult) {
				const uri = sourceFiles.fromEmbeddedDocumentUri(lsType, tsDocEdit.uri)?.sourceDocument.uri ?? tsDocEdit.uri;
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
