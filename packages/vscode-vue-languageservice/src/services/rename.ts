import {
	Position,
	TextDocument,
	WorkspaceEdit,
	Location,
	TextEdit,
} from 'vscode-languageserver';
import { SourceFile } from '../sourceFiles';
import {
	tsLocationToVueLocationsRaw,
	findSourceFileByTsUri,
} from '../utils/commons';
import { hyphenate } from '@vue/shared';
import { MapedNodeTypes, SourceMap } from '../utils/sourceMaps';
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
			let vueEdits: WorkspaceEdit[] = [];
			let tsLocations: Location[] = [];

			for (const sourceMap of sourceFile.getTsSourceMaps()) {
				let startWithScriptSetup = false;
				let startWithNoDollarRef = false;
				let startWithStyle = false;
				for (const tsLoc of sourceMap.sourceToTargets(range)) {
					if (tsLoc.maped.data.capabilities.rename) {
						if (tsLoc.maped.data.vueTag === 'scriptSetup') {
							startWithScriptSetup = true;
						}
						if (tsLoc.maped.data.isNoDollarRef) {
							startWithNoDollarRef = true;
						}
						if (tsLoc.maped.data.vueTag === 'style') {
							startWithStyle = true;
						}
					}
				}
				if (startWithStyle && newName.startsWith('.')) {
					newName = newName.substr(1);
				}
				for (const tsLoc of sourceMap.sourceToTargets(range)) {
					if (!tsLoc.maped.data.capabilities.rename) continue;
					const tsEdit = worker(sourceMap.targetDocument, tsLoc.range.start, newName);
					if (!tsEdit) continue;
					const hasNoDollarRef = hasScriptRefReference(tsEdit);
					const startWithDollarRef = startWithScriptSetup && !startWithNoDollarRef && hasNoDollarRef;
					keepHtmlTagOrAttrStyle(tsEdit);
					const vueEdit = getSourceWorkspaceEdit(tsEdit, hasNoDollarRef, startWithDollarRef, sourceFile);
					vueEdits.push(vueEdit);
				}
			}

			const vueEdit = margeWorkspaceEdits(vueEdits);
			return deduplication(vueEdit);

			function worker(doc: TextDocument, pos: Position, newName: string) {
				let rename = tsLanguageService.doRename(doc, pos, newName);
				if (!rename) return;
				for (const tsUri in rename.changes) {
					const tsEdits = rename.changes[tsUri];
					for (const tsEdit of tsEdits) {
						const tsLoc = { uri: tsUri, range: tsEdit.range };
						if (hasLocation(tsLoc)) continue;
						tsLocations.push(tsLoc);
						const sourceFile_2 = findSourceFileByTsUri(sourceFiles, tsUri);
						const tsm = sourceFile_2?.getMirrorsSourceMaps();
						if (tsm?.contextSourceMap?.sourceDocument.uri === tsLoc.uri)
							transfer(tsm.contextSourceMap);
						if (tsm?.componentSourceMap?.sourceDocument.uri === tsLoc.uri)
							transfer(tsm.componentSourceMap);
						if (tsm?.scriptSetupSourceMap?.sourceDocument.uri === tsLoc.uri)
							transfer(tsm.scriptSetupSourceMap);
						function transfer(sourceMap: SourceMap) {
							const leftRange = sourceMap.isSource(tsLoc.range)
								? tsLoc.range
								: sourceMap.targetToSource(tsLoc.range)?.range;
							if (leftRange) {
								const leftLoc = { uri: sourceMap.sourceDocument.uri, range: leftRange };
								if (!hasLocation(leftLoc)) {
									const rename2 = worker(sourceMap.sourceDocument, leftLoc.range.start, newName);
									if (rename && rename2) {
										rename = margeWorkspaceEdits([rename, rename2]);
									}
								}
								const rightLocs = sourceMap.sourceToTargets(leftRange);
								for (const rightLoc of rightLocs) {
									const rightLoc_2 = { uri: sourceMap.sourceDocument.uri, range: rightLoc.range };
									if (!hasLocation(rightLoc_2)) {
										const rename2 = worker(sourceMap.sourceDocument, rightLoc_2.range.start, newName);
										if (rename && rename2) {
											rename = margeWorkspaceEdits([rename, rename2]);
										}
									}
								}
							}
						}
					}
				}
				return rename;
			}
			// TODO: use map
			function hasLocation(loc: Location) {
				return !!tsLocations.find(tsLoc =>
					tsLoc.uri === loc.uri
					&& tsLoc.range.start.line === loc.range.start.line
					&& tsLoc.range.start.character === loc.range.start.character
					&& tsLoc.range.end.line === loc.range.end.line
					&& tsLoc.range.end.character === loc.range.end.character
				)
			}
			function keepHtmlTagOrAttrStyle(tsWorkspaceEdit: WorkspaceEdit) {
				if (!tsWorkspaceEdit?.changes) return;
				for (const uri in tsWorkspaceEdit.changes) {
					const editSourceFile = findSourceFileByTsUri(sourceFiles, uri);
					if (!editSourceFile) continue;
					for (const sourceMap of editSourceFile.getTsSourceMaps()) {
						if (sourceMap.targetDocument.uri !== uri) continue;
						for (const textEdit of tsWorkspaceEdit.changes[uri]) {
							for (const vueLoc of sourceMap.targetToSources(textEdit.range)) {
								const oldName = sourceMap.sourceDocument.getText(vueLoc.range);
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
				for (const htmlLoc of sourceMap.sourceToTargets(range)) {
					const htmlEdits = globalServices.html.doRename(sourceMap.targetDocument, htmlLoc.range.start, newName, sourceMap.htmlDocument);
					if (!htmlEdits) continue;
					if (!htmlEdits.changes) continue;
					for (const uri in htmlEdits.changes) {
						const edits = htmlEdits.changes[uri];
						for (const htmlEdit of edits) {
							const vueLoc = sourceMap.targetToSource(htmlEdit.range);
							if (!vueLoc) continue;
							const vueUri = sourceMap.sourceDocument.uri;
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
				const cssLanguageService = globalServices.getCssService(sourceMap.targetDocument.languageId);
				for (const cssLoc of sourceMap.sourceToTargets(range)) {
					const cssEdits = cssLanguageService.doRename(sourceMap.targetDocument, cssLoc.range.start, newName, sourceMap.stylesheet);
					if (!cssEdits) continue;
					if (!cssEdits.changes) continue;
					for (const uri in cssEdits.changes) {
						const edits = cssEdits.changes[uri];
						for (const cssEdit of edits) {
							const vueLoc = sourceMap.targetToSource(cssEdit.range);
							if (!vueLoc) continue;
							const vueUri = sourceMap.sourceDocument.uri;
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
		function hasScriptRefReference(workspaceEdit: WorkspaceEdit) {
			for (const uri in workspaceEdit.changes) {
				const edits = workspaceEdit.changes[uri];
				for (const edit of edits) {
					const location = Location.create(uri, edit.range);
					const sourceLocations = tsLocationToVueLocationsRaw(location, sourceFiles);
					for (const [_, data] of sourceLocations) {
						if (data && !data.capabilities.rename) continue;
						if (data?.isNoDollarRef) return true;
					}
				}
			}
			return false;
		}
		function getSourceWorkspaceEdit(workspaceEdit: WorkspaceEdit, isRefSugarRenaming: boolean, startWithDollarRef: boolean, sourceFile: SourceFile) {
			const desc = sourceFile.getDescriptor();
			const genData = sourceFile.getScriptSetupData();
			const newWorkspaceEdit: WorkspaceEdit = {
				changes: {}
			};
			for (const uri in workspaceEdit.changes) {
				const edits = workspaceEdit.changes[uri];
				for (const edit of edits) {
					const location = Location.create(uri, edit.range);
					const sourceLocations = tsLocationToVueLocationsRaw(location, sourceFiles);
					for (const [sourceLocation, data] of sourceLocations) {
						if (data && !data.capabilities.rename) continue;
						let newText = edit.newText;
						patchRefSugar();
						if (data?.vueTag === 'style') {
							newText = '.' + newText;
						}
						const sourceTextEdit = TextEdit.replace(sourceLocation.range, newText);
						const sourceUri = sourceLocation.uri;
						if (!newWorkspaceEdit.changes![sourceUri]) {
							newWorkspaceEdit.changes![sourceUri] = [];
						}
						newWorkspaceEdit.changes![sourceUri].push(sourceTextEdit);

						function patchRefSugar() {
							const isDollarRef = isRefSugarRenaming && data?.vueTag === 'scriptSetup' && !data?.isNoDollarRef;
							let shouldAddDollar = false;
							if (isDollarRef) {
								if (!startWithDollarRef)
									shouldAddDollar = true;
								else if (newText.indexOf(': ') === -1 && !newText.startsWith('$'))
									shouldAddDollar = true;
								else if (newText.indexOf(': ') >= 0 && newText.indexOf(': $') === -1)
									shouldAddDollar = true;
							}
							if (isDollarRef && (!newText.startsWith('$') || !startWithDollarRef)) {
								shouldAddDollar = true;
							}
							let isShorthand = false;
							if (genData && desc.scriptSetup) {
								const renameRange = {
									start: sourceFile.getTextDocument().offsetAt(sourceLocation.range.start),
									end: sourceFile.getTextDocument().offsetAt(sourceLocation.range.end),
								};
								for (const shorthandProperty of genData.data.shorthandPropertys) {
									if (
										renameRange.start === desc.scriptSetup.loc.start + shorthandProperty.start
										&& renameRange.end === desc.scriptSetup.loc.start + shorthandProperty.end
									) {
										isShorthand = true;
										break;
									}
								}
							}
							if (isShorthand) {
								if (newText.indexOf(': ') >= 0) {
									if (shouldAddDollar) {
										newText = newText.replace(': ', ': $');
									}
								}
								else {
									const originalText = sourceFile.getTextDocument().getText(sourceLocation.range);
									newText = originalText + ': ' + newText;
								}
							}
							else if (shouldAddDollar) {
								newText = '$' + newText;
							}
							if (!isDollarRef && startWithDollarRef && newText.startsWith('$')) {
								newText = newText.substr(1);
							}
						}
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
