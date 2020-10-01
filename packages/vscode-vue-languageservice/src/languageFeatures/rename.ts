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
} from '../utils/commons';

export function register(sourceFiles: Map<string, SourceFile>) {
	return (document: TextDocument, position: Position, newName: string) => {
		const sourceFile = sourceFiles.get(document.uri);
		if (!sourceFile) return;
		const range = { start: position, end: position };

		const tsResult = getTsResult(sourceFile);
		const htmlResult = getHtmlResult(sourceFile);
		const cssResult = getCssResult(sourceFile);

		for (const result of [tsResult, ...cssResult, ...htmlResult]) {
			if (result.changes && Object.keys(result.changes).length) {
				return result;
			}
		}

		function getTsResult(sourceFile: SourceFile) {
			let workspaceEdits: WorkspaceEdit[] = [];

			for (const sourceMap of sourceFile.getTsSourceMaps()) {
				for (const tsLoc of sourceMap.findTargets(range)) {
					if (!tsLoc.data.capabilities.references) continue;
					const entries = getTsActionEntries(sourceMap.targetDocument, tsLoc.range, tsLoc.data.vueTag, 'rename', getRenameLocations, sourceMap.languageService, sourceFiles);

					for (const entry of entries) {
						const entryDocument = sourceMap.languageService.getTextDocument(entry.uri);
						if (!entryDocument) continue;
						const edit = sourceMap.languageService.doRename(entryDocument, entry.range.start, newName);
						if (edit) {
							workspaceEdits.push(edit);
						}
					}

					function getRenameLocations(document: TextDocument, position: Position) {
						const workspaceEdit = sourceMap.languageService.doRename(document, position, newName);
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

			workspaceEdits = workspaceEdits.map(edit => getSourceWorkspaceEdit(edit));
			let workspaceEdit = margeWorkspaceEdits(workspaceEdits);
			workspaceEdit = deduplication(workspaceEdit);

			return workspaceEdit;
		}
		function getHtmlResult(sourceFile: SourceFile) {
			const result: WorkspaceEdit[] = [];
			for (const sourceMap of sourceFile.getHtmlSourceMaps()) {
				for (const htmlLoc of sourceMap.findTargets(range)) {
					const workspaceEdit = sourceMap.languageService.doRename(sourceMap.targetDocument, htmlLoc.range.start, newName, sourceMap.htmlDocument);
					if (workspaceEdit) {
						if (workspaceEdit.changes) {
							for (const uri in workspaceEdit.changes) {
								const edits = workspaceEdit.changes[uri];
								for (const edit of edits) {
									const vueLoc = sourceMap.findSource(edit.range);
									if (vueLoc) edit.range = vueLoc.range;
								}
							}
						}
						result.push(workspaceEdit);
					}
				}
			}
			return result;
		}
		function getCssResult(sourceFile: SourceFile) {
			const result: WorkspaceEdit[] = [];
			for (const sourceMap of sourceFile.getCssSourceMaps()) {
				for (const cssLoc of sourceMap.findTargets(range)) {
					const workspaceEdit = sourceMap.languageService.doRename(sourceMap.targetDocument, cssLoc.range.start, newName, sourceMap.stylesheet);
					if (workspaceEdit) {
						if (workspaceEdit.changes) {
							for (const uri in workspaceEdit.changes) {
								const edits = workspaceEdit.changes[uri];
								for (const edit of edits) {
									const vueLoc = sourceMap.findSource(edit.range);
									if (vueLoc) edit.range = vueLoc.range;
								}
							}
						}
						result.push(workspaceEdit);
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
