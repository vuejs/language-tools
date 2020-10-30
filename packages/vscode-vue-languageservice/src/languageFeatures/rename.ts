import {
	Position,
	TextDocument,
	WorkspaceEdit,
	Location,
	TextEdit,
} from 'vscode-languageserver';
import { SourceFile } from '../sourceFiles';
import {
	getTsActionEntries,
	getSourceTsLocations,
	findSourceFileByTsUri,
} from '../utils/commons';
import { hyphenate } from '@vue/shared';
import { MapedNodeTypes } from '../utils/sourceMaps';
import * as globalServices from '../globalServices';
import type * as ts2 from '@volar/vscode-typescript-languageservice';

export function register(sourceFiles: Map<string, SourceFile>, tsLanguageService: ts2.LanguageService) {
	return (document: TextDocument, position: Position, newName: string) => {
		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile) return;
		const range = { start: position, end: position };

		const tsResult = getTsResult(sourceFile);
		if (tsResult.changes && Object.keys(tsResult.changes).length) {
			return tsResult;
		}

		const htmlResult = getHtmlResult(sourceFile);
		if (htmlResult.changes && Object.keys(htmlResult.changes).length) {
			return htmlResult;
		}

		const cssResult = getCssResult(sourceFile);
		if (cssResult.changes && Object.keys(cssResult.changes).length) {
			return cssResult;
		}

		function getTsResult(sourceFile: SourceFile) {
			let tsEdits: WorkspaceEdit[] = [];

			for (const sourceMap of sourceFile.getTsSourceMaps()) {
				for (const tsLoc of sourceMap.findVirtualLocations(range)) {
					if (!tsLoc.maped.data.capabilities.rename) continue;
					const entries = getTsActionEntries(sourceMap.virtualDocument, tsLoc.range, tsLoc.maped.data.vueTag, 'rename', getRenameLocations, tsLanguageService, sourceFiles);

					for (const entry of entries) {
						const entryDocument = tsLanguageService.getTextDocument(entry.uri);
						if (!entryDocument) continue;
						const tsEdit = tsLanguageService.doRename(entryDocument, entry.range.start, newName);
						if (!tsEdit) continue;
						tsEdits.push(tsEdit);
					}

					function getRenameLocations(document: TextDocument, position: Position) {
						const workspaceEdit = tsLanguageService.doRename(document, position, newName);
						if (!workspaceEdit) return [];

						const locations: Location[] = [];
						for (const uri in workspaceEdit.changes) {
							const edits = workspaceEdit.changes[uri];
							for (const edit of edits) {
								const location = Location.create(uri, edit.range);
								locations.push(location);
							}
						}

						return locations;
					}
				}
			}

			for (const tsEdit of tsEdits) {
				keepHtmlTagOrAttrStyle(tsEdit);
			}
			const vueEdits = tsEdits.map(edit => getSourceWorkspaceEdit(edit));
			const vueEdit = margeWorkspaceEdits(vueEdits);
			return deduplication(vueEdit);

			function keepHtmlTagOrAttrStyle(tsWorkspaceEdit: WorkspaceEdit) {
				if (!tsWorkspaceEdit?.changes) return;
				for (const uri in tsWorkspaceEdit.changes) {
					const editSourceFile = findSourceFileByTsUri(sourceFiles, uri);
					if (!editSourceFile) continue;
					for (const sourceMap of editSourceFile.getTsSourceMaps()) {
						if (sourceMap.virtualDocument.uri !== uri) continue;
						for (const textEdit of tsWorkspaceEdit.changes[uri]) {
							for (const vueLoc of sourceMap.findVueLocations(textEdit.range)) {
								const oldName = sourceMap.vueDocument.getText(vueLoc.range);
								const isHyphenateName = oldName === hyphenate(oldName)
								const isHtmlTag = vueLoc.maped.data.type === MapedNodeTypes.ElementTag;
								const isAttrArg = vueLoc.maped.data.type === MapedNodeTypes.Prop;
								if ((isHtmlTag || isAttrArg) && isHyphenateName) {
									textEdit.newText = hyphenate(textEdit.newText);
									break;
								}
							}
						}
					}
				}
			}
		}
		function getHtmlResult(sourceFile: SourceFile) {
			const result: WorkspaceEdit = { changes: {} };
			for (const sourceMap of sourceFile.getHtmlSourceMaps()) {
				for (const htmlLoc of sourceMap.findVirtualLocations(range)) {
					const htmlEdits = globalServices.html.doRename(sourceMap.virtualDocument, htmlLoc.range.start, newName, sourceMap.htmlDocument);
					if (!htmlEdits) continue;
					if (!htmlEdits.changes) continue;
					for (const uri in htmlEdits.changes) {
						const edits = htmlEdits.changes[uri];
						for (const htmlEdit of edits) {
							const vueLoc = sourceMap.findFirstVueLocation(htmlEdit.range);
							if (!vueLoc) continue;
							const vueUri = sourceMap.vueDocument.uri;
							if (!result.changes![vueUri]) {
								result.changes![vueUri] = [];
							}
							result.changes![vueUri].push({
								range: vueLoc.range,
								newText: htmlEdit.newText,
							});
						}
					}
				}
			}
			return result;
		}
		function getCssResult(sourceFile: SourceFile) {
			const result: WorkspaceEdit = { changes: {} };
			for (const sourceMap of sourceFile.getCssSourceMaps()) {
				const cssLanguageService = globalServices.getCssService(sourceMap.virtualDocument.languageId);
				for (const cssLoc of sourceMap.findVirtualLocations(range)) {
					const cssEdits = cssLanguageService.doRename(sourceMap.virtualDocument, cssLoc.range.start, newName, sourceMap.stylesheet);
					if (!cssEdits) continue;
					if (!cssEdits.changes) continue;
					for (const uri in cssEdits.changes) {
						const edits = cssEdits.changes[uri];
						for (const cssEdit of edits) {
							const vueLoc = sourceMap.findFirstVueLocation(cssEdit.range);
							if (!vueLoc) continue;
							const vueUri = sourceMap.vueDocument.uri;
							if (!result.changes![vueUri]) {
								result.changes![vueUri] = [];
							}
							result.changes![vueUri].push({
								range: vueLoc.range,
								newText: cssEdit.newText,
							});
						}
					}
				}
			}
			return result;
		}
		function getSourceWorkspaceEdit(workspaceEdit: WorkspaceEdit) {
			const newWorkspaceEdit: WorkspaceEdit = {
				changes: {}
			};
			for (const uri in workspaceEdit.changes) {
				const edits = workspaceEdit.changes[uri];
				for (const edit of edits) {
					const location = Location.create(uri, edit.range);
					const sourceLocations = getSourceTsLocations(location, sourceFiles);
					for (const sourceLocation of sourceLocations) {
						const sourceTextEdit = TextEdit.replace(sourceLocation.range, edit.newText);
						const sourceUri = sourceLocation.uri;
						if (!newWorkspaceEdit.changes![sourceUri]) {
							newWorkspaceEdit.changes![sourceUri] = [];
						}
						newWorkspaceEdit.changes![sourceUri].push(sourceTextEdit);
					}
				}
			}
			return newWorkspaceEdit;
		}
		function deduplication(workspaceEdit: WorkspaceEdit) {
			for (const uri in workspaceEdit.changes) {
				let edits = workspaceEdit.changes[uri];
				const map = new Map<string, TextEdit>();
				for (const edit of edits) {
					map.set(`${edit.newText}:${JSON.stringify(edit.range)}`, edit);
				}
				edits = [...map.values()];
				workspaceEdit.changes[uri] = edits;
			}
			return workspaceEdit;
		}
		function margeWorkspaceEdits(workspaceEdits: WorkspaceEdit[]) {
			const newWorkspaceEdit: WorkspaceEdit = {
				changes: {}
			};
			for (const workspaceEdit of workspaceEdits) {
				for (const uri in workspaceEdit.changes) {
					if (!newWorkspaceEdit.changes![uri]) {
						newWorkspaceEdit.changes![uri] = [];
					}
					const edits = workspaceEdit.changes[uri];
					newWorkspaceEdit.changes![uri] = newWorkspaceEdit.changes![uri].concat(edits);
				}
			}
			return newWorkspaceEdit;
		}
	}
}
