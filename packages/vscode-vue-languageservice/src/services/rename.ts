import * as shared from '@volar/shared';
import * as vscode from 'vscode-languageserver';
import type { SourceFiles } from '../sourceFiles';
import type { ApiLanguageServiceContext } from '../types';
import * as dedupe from '../utils/dedupe';
import type { TsMappingData } from '../utils/sourceMaps';
import { wordPatterns } from './completion';

export function register({ sourceFiles, getCssLs, getTsLs, scriptTsLs }: ApiLanguageServiceContext) {

	return {
		prepareRename: (uri: string, position: vscode.Position): vscode.ResponseError | vscode.Range | undefined => {

			const tsResult = onTsPrepare(uri, position);
			if (tsResult) {
				return tsResult;
			}

			const cssResult = onCssPrepare(uri, position);
			if (cssResult) {
				return cssResult;
			}
		},
		doRename: async (uri: string, position: vscode.Position, newName: string) => {

			const tsResult = await doTsRename(uri, position, newName);
			if (tsResult) {
				doDedupe(tsResult);
				return tsResult;
			}

			const cssResult = onCss(uri, position, newName);
			if (cssResult) {
				doDedupe(cssResult);
				return cssResult;
			}

			function doDedupe(workspaceEdit: vscode.WorkspaceEdit) {
				if (workspaceEdit.changes) {
					for (const uri in workspaceEdit.changes) {
						workspaceEdit.changes[uri] = dedupe.withTextEdits(workspaceEdit.changes[uri]);
					}
				}
			}
		},
		onRenameFile: onTsFile,
	}

	function onTsPrepare(uri: string, position: vscode.Position) {
		for (const tsLoc of sourceFiles.toTsLocations(uri, position)) {
			const tsLs = getTsLs(tsLoc.lsType);
			if (
				tsLoc.type === 'source-ts'
				|| tsLoc.range.data.capabilities.rename === true
				|| (typeof tsLoc.range.data.capabilities.rename === 'object' && tsLoc.range.data.capabilities.rename.in)
			) {
				const tsPrepare = tsLs.prepareRename(
					tsLoc.uri,
					tsLoc.range.start,
				);
				if (!tsPrepare)
					continue;

				if (tsPrepare instanceof vscode.ResponseError)
					return tsPrepare;

				for (const vueLoc of sourceFiles.fromTsLocation(tsLoc.lsType, tsLoc.uri, tsPrepare.start, tsPrepare.end))
					return vueLoc.range;
			}
		}
	}
	async function onTsFile(oldUri: string, newUri: string) {

		const sourceFile = sourceFiles.get(oldUri);
		const isVirtualFile = !!sourceFile;
		const tsOldUri = sourceFile ? sourceFile.getScriptTsDocument().uri : oldUri;
		const tsNewUri = isVirtualFile ? newUri + '.ts' : newUri;
		const tsResult = await scriptTsLs.getEditsForFileRename(tsOldUri, tsNewUri);

		if (tsResult) {
			return tsEditToVueEdit('script', tsResult, sourceFiles, canRename);
		}
	}
	async function doTsRename(uri: string, position: vscode.Position, newName: string) {

		let result: vscode.WorkspaceEdit | undefined;

		for (const tsLoc of sourceFiles.toTsLocations(uri, position)) {
			if (
				tsLoc.type === 'source-ts'
				|| tsLoc.range.data.capabilities.rename === true
				|| (typeof tsLoc.range.data.capabilities.rename === 'object' && tsLoc.range.data.capabilities.rename.in)
			) {

				let newName_2 = newName;
				if (tsLoc.type === 'embedded-ts' && tsLoc.range.data.beforeRename)
					newName_2 = tsLoc.range.data.beforeRename(newName);

				const tsResult = await doTsRenameWorker(tsLoc.lsType, tsLoc.uri, tsLoc.range.start, newName_2);
				if (tsResult) {
					const vueResult = tsEditToVueEdit(tsLoc.lsType, tsResult, sourceFiles, canRename);
					if (vueResult) {
						if (!result)
							result = vueResult;
						else
							margeWorkspaceEdits(result, vueResult);
					}
				}
			}
		}

		return result;
	}
	async function doTsRenameWorker(lsType: 'script' | 'template', tsUri: string, position: vscode.Position, newName: string, loopChecker = dedupe.createLocationSet()) {

		if (loopChecker.has({ uri: tsUri, range: { start: position, end: position } }))
			return;
		loopChecker.add({ uri: tsUri, range: { start: position, end: position } });

		const tsLs = getTsLs(lsType);
		const tsResult = await tsLs.doRename(
			tsUri,
			position,
			newName,
		);

		if (tsResult?.changes) {
			for (const editUri in tsResult.changes) {
				const textEdits = tsResult.changes[editUri];
				for (const textEdit of textEdits) {

					loopChecker.add({ uri: editUri, range: textEdit.range });

					const teleport = sourceFiles.getTsTeleports(lsType).get(editUri);

					if (!teleport)
						continue;

					if (
						!teleport.allowCrossFile
						&& sourceFiles.getSourceFileByTsUri(lsType, editUri) !== sourceFiles.getSourceFileByTsUri(lsType, tsUri)
					) continue;

					for (const teleRange of teleport.findTeleports(textEdit.range.start, textEdit.range.end)) {
						if (!teleRange.sideData.capabilities.rename)
							continue;
						if (loopChecker.has({ uri: editUri, range: teleRange }))
							continue;
						const newName_2 = teleRange.sideData.editRenameText
							? teleRange.sideData.editRenameText(newName)
							: newName;
						const tsResult_2 = await doTsRenameWorker(lsType, editUri, teleRange.start, newName_2, loopChecker);
						if (tsResult_2) {
							margeWorkspaceEdits(tsResult, tsResult_2);
						}
					}
				}
			}
		}

		return tsResult;
	}
	function onCssPrepare(uri: string, position: vscode.Position) {

		const sourceFile = sourceFiles.get(uri);
		if (!sourceFile)
			return;

		for (const sourceMap of sourceFile.getCssSourceMaps()) {
			for (const cssRange of sourceMap.getMappedRanges(position)) {
				const wordPattern = wordPatterns[sourceMap.mappedDocument.languageId] ?? wordPatterns.css;
				const wordRange = shared.getWordRange(wordPattern, cssRange.end, sourceMap.mappedDocument);
				if (wordRange) {
					for (const vueRange of sourceMap.getSourceRanges(wordRange.start, wordRange.end)) {
						return vueRange as vscode.Range;
					}
				}
			}
		}
	}
	function onCss(uri: string, position: vscode.Position, newName: string) {

		const sourceFile = sourceFiles.get(uri);
		if (!sourceFile)
			return;

		const cssResult: vscode.WorkspaceEdit = { changes: {} };
		const vueResult: vscode.WorkspaceEdit = { changes: {} };
		let hasResult = false;

		// vue -> css
		for (const sourceMap of sourceFile.getCssSourceMaps()) {

			if (!sourceMap.stylesheet)
				continue;

			const cssLs = getCssLs(sourceMap.mappedDocument.languageId);
			if (!cssLs)
				continue;

			for (const cssRange of sourceMap.getMappedRanges(position)) {
				const cssWorkspaceEdit = cssLs.doRename(
					sourceMap.mappedDocument,
					cssRange.start,
					newName,
					sourceMap.stylesheet,
				);
				if (cssWorkspaceEdit) {
					hasResult = true;
					margeWorkspaceEdits(cssResult, cssWorkspaceEdit);
				}
			}
		}

		if (!hasResult)
			return;

		// css -> vue
		for (const cssUri in cssResult.changes) {

			const sourceMap = sourceFiles.getCssSourceMaps().get(cssUri);
			if (!sourceMap)
				continue;

			const cssEdits = cssResult.changes[cssUri];
			for (const cssEdit of cssEdits) {
				for (const vueRange of sourceMap.getSourceRanges(cssEdit.range.start, cssEdit.range.end)) {
					if (!vueResult.changes) {
						vueResult.changes = {};
					}
					if (!vueResult.changes[sourceMap.sourceDocument.uri]) {
						vueResult.changes[sourceMap.sourceDocument.uri] = [];
					}
					vueResult.changes[sourceMap.sourceDocument.uri].push({
						newText: cssEdit.newText,
						range: vueRange,
					});
				}
			}
		}

		return vueResult;
	}
}

function canRename(data?: TsMappingData) {
	return !data
		|| data.capabilities.rename === true
		|| (typeof data.capabilities.rename === 'object' && data.capabilities.rename.out)
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
export function tsEditToVueEdit(lsType: 'script' | 'template', tsResult: vscode.WorkspaceEdit, sourceFiles: SourceFiles, isValidRange: (data?: TsMappingData) => boolean) {
	const vueResult: vscode.WorkspaceEdit = {};
	let hasResult = false;

	for (const tsUri in tsResult.changeAnnotations) {

		if (!vueResult.changeAnnotations)
			vueResult.changeAnnotations = {};

		const tsAnno = tsResult.changeAnnotations[tsUri];
		const uri = sourceFiles.getSourceFileByTsUri(lsType, tsUri)?.uri ?? tsUri;
		vueResult.changeAnnotations[uri] = tsAnno;
	}
	for (const tsUri in tsResult.changes) {
		const tsEdits = tsResult.changes[tsUri];
		for (const tsEdit of tsEdits) {
			for (const vueLoc of sourceFiles.fromTsLocation(lsType, tsUri, tsEdit.range.start, tsEdit.range.end)) {

				if (vueLoc.type === 'embedded-ts' && !vueLoc.range.data.capabilities.rename)
					continue;

				if (vueLoc.type === 'embedded-ts' && typeof vueLoc.range.data.capabilities.rename === 'object' && !vueLoc.range.data.capabilities.rename.out)
					continue;

				if (vueLoc.type === 'source-ts' && lsType === 'template')
					continue;

				let newText_2 = tsEdit.newText;
				if (vueLoc.type === 'embedded-ts' && vueLoc.range.data.doRename) {
					const vueDoc = vueLoc.sourceMap.sourceDocument;
					newText_2 = vueLoc.range.data.doRename(vueDoc.getText(vueLoc.range), tsEdit.newText);
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
				const sourceMap = sourceFiles.getTsSourceMaps(lsType).get(tsDocEdit.textDocument.uri);
				if (sourceMap) {
					vueDocEdit = vscode.TextDocumentEdit.create(
						{ uri: sourceMap.sourceDocument.uri, version: sourceMap.sourceDocument.version },
						[],
					);
					for (const tsEdit of tsDocEdit.edits) {
						for (const vueRange of sourceMap.getSourceRanges(tsEdit.range.start, tsEdit.range.end)) {
							if (isValidRange(vueRange.data)) {
								vueDocEdit.edits.push({
									annotationId: vscode.AnnotatedTextEdit.is(tsEdit.range) ? tsEdit.range.annotationId : undefined,
									newText: tsEdit.newText,
									range: vueRange,
								});
							}
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
				const oldUri = sourceFiles.getSourceFileByTsUri(lsType, tsDocEdit.oldUri)?.uri ?? tsDocEdit.oldUri;
				vueDocEdit = vscode.RenameFile.create(oldUri, tsDocEdit.newUri /* TODO: remove .ts? */, tsDocEdit.options, tsDocEdit.annotationId);
			}
			else if (vscode.DeleteFile.is(tsDocEdit)) {
				const uri = sourceFiles.getSourceFileByTsUri(lsType, tsDocEdit.uri)?.uri ?? tsDocEdit.uri;
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
