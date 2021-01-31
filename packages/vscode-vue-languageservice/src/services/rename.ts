import type { TsApiRegisterOptions } from '../types';
import type { Position } from 'vscode-languageserver/node';
import type { WorkspaceEdit } from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as dedupe from '../utils/dedupe';

export function register({ mapper }: TsApiRegisterOptions) {

	return (document: TextDocument, position: Position, newName: string) => {

		const tsResult = onTs(document.uri, position, newName);
		if (tsResult.changes && Object.keys(tsResult.changes).length) {
			return tsResult;
		}

		const cssResult = onCss(document.uri, position, newName);
		if (cssResult.changes && Object.keys(cssResult.changes).length) {
			return cssResult;
		}
	}

	function onTs(uri: string, position: Position, newName: string) {

		const loopChecker = dedupe.createLocationSet();
		const tsResult: WorkspaceEdit = { changes: {} };
		const vueResult: WorkspaceEdit = { changes: {} };

		// vue -> ts
		for (const tsMaped of mapper.ts.to(uri, { start: position, end: position })) {
			if (
				tsMaped.data.capabilities.rename === true
				|| (typeof tsMaped.data.capabilities.rename === 'object' && tsMaped.data.capabilities.rename.in)
			) {
				const newName_2 = tsMaped.data.beforeRename ? tsMaped.data.beforeRename(newName) : newName;
				withTeleports(tsMaped.textDocument.uri, tsMaped.range.start, newName_2);

				function withTeleports(uri: string, position: Position, newName: string) {

					const tsWorkspaceEdit = tsMaped.languageService.doRename(
						uri,
						position,
						newName,
					);

					if (tsWorkspaceEdit?.changes) {
						margeWorkspaceEdits(tsResult, tsWorkspaceEdit);

						for (const editUri in tsWorkspaceEdit.changes) {
							const textEdits = tsWorkspaceEdit.changes[editUri];
							for (const textEdit of textEdits) {
								loopChecker.add({ uri: editUri, range: textEdit.range });
								for (const teleport of mapper.ts.teleports(editUri, textEdit.range)) {
									if (!teleport.sideData.capabilities.rename)
										continue;
									if (loopChecker.has({ uri: editUri, range: teleport.range }))
										continue;
									const newName_2 = teleport.sideData.editRenameText
										? teleport.sideData.editRenameText(newName)
										: newName;
									withTeleports(editUri, teleport.range.start, newName_2);
								}
							}
						}
					}
				}
			}
		}

		// ts -> vue
		for (const tsUri in tsResult.changes) {
			const tsEdits = tsResult.changes[tsUri];
			for (const tsEdit of tsEdits) {
				for (const vueMaped of mapper.ts.from(tsUri, tsEdit.range)) {
					if (
						!vueMaped.data
						|| vueMaped.data.capabilities.rename === true
						|| (typeof vueMaped.data.capabilities.rename === 'object' && vueMaped.data.capabilities.rename.out)
					) {
						const newText_2 = vueMaped.data?.doRename
							? vueMaped.data.doRename(vueMaped.textDocument.getText(vueMaped.range), tsEdit.newText)
							: tsEdit.newText;

						if (!vueResult.changes) {
							vueResult.changes = {};
						}
						if (!vueResult.changes[vueMaped.textDocument.uri]) {
							vueResult.changes[vueMaped.textDocument.uri] = [];
						}
						vueResult.changes[vueMaped.textDocument.uri].push({
							newText: newText_2,
							range: vueMaped.range,
						});
					}
				}
			}
		}

		return vueResult;
	}
	function onCss(uri: string, position: Position, newName: string) {

		const cssResult: WorkspaceEdit = { changes: {} };
		const vueResult: WorkspaceEdit = { changes: {} };

		// vue -> css
		for (const cssMaped of mapper.css.to(uri, { start: position, end: position })) {
			const cssWorkspaceEdit = cssMaped.languageService.doRename(
				cssMaped.textDocument,
				cssMaped.range.start,
				newName,
				cssMaped.stylesheet,
			);
			if (cssWorkspaceEdit) {
				margeWorkspaceEdits(cssResult, cssWorkspaceEdit);
			}
		}

		// css -> vue
		for (const cssUri in cssResult.changes) {
			const cssEdits = cssResult.changes[cssUri];
			for (const cssEdit of cssEdits) {
				for (const vueMaped of mapper.css.from(cssUri, cssEdit.range)) {
					if (!vueResult.changes) {
						vueResult.changes = {};
					}
					if (!vueResult.changes[vueMaped.textDocument.uri]) {
						vueResult.changes[vueMaped.textDocument.uri] = [];
					}
					vueResult.changes[vueMaped.textDocument.uri].push({
						newText: cssEdit.newText,
						range: vueMaped.range,
					});
				}
			}
		}

		return vueResult;
	}
}

function margeWorkspaceEdits(original: WorkspaceEdit, ...others: WorkspaceEdit[]) {
	if (!original.changes) {
		original.changes = {};
	}
	for (const workspaceEdit of others) {
		for (const uri in workspaceEdit.changes) {
			if (!original.changes[uri]) {
				original.changes[uri] = [];
			}
			const edits = workspaceEdit.changes[uri];
			original.changes[uri] = original.changes![uri].concat(edits);
		}
	}
}
