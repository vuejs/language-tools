import type { TsApiRegisterOptions } from '../types';
import type { Position } from 'vscode-languageserver/node';
import type { WorkspaceEdit } from 'vscode-languageserver/node';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as dedupe from '../utils/dedupe';
import { TextDocumentEdit } from 'vscode-languageserver/node';
import { CreateFile } from 'vscode-languageserver/node';
import { RenameFile } from 'vscode-languageserver/node';
import { DeleteFile } from 'vscode-languageserver/node';
import { AnnotatedTextEdit } from 'vscode-languageserver/node';
import { ResponseError } from 'vscode-languageserver/node';

export function register({ mapper }: TsApiRegisterOptions) {

	return {
		onPrepare: (document: TextDocument, position: Position) => {
			const tsResult = onTsPrepare(document.uri, position);
			return tsResult;
		},
		onRename: (document: TextDocument, position: Position, newName: string) => {

			const tsResult = onTs(document.uri, position, newName);
			if (tsResult) {
				return tsResult;
			}

			const cssResult = onCss(document.uri, position, newName);
			if (cssResult) {
				return cssResult;
			}
		},
		onRenameFile: onTsFile,
	}

	function onTsPrepare(uri: string, position: Position) {
		for (const tsMaped of mapper.ts.to(uri, { start: position, end: position })) {
			if (
				tsMaped.data.capabilities.rename === true
				|| (typeof tsMaped.data.capabilities.rename === 'object' && tsMaped.data.capabilities.rename.in)
			) {
				const tsRange = tsMaped.languageService.prepareRename(
					tsMaped.textDocument.uri,
					tsMaped.range.start,
				);
				if (!tsRange)
					continue;

				if (tsRange instanceof ResponseError)
					return tsRange;

				for (const vueMaped of mapper.ts.from(tsMaped.textDocument.uri, tsRange))
					return vueMaped.range;
			}
		}
	}
	function onTsFile(oldUri: string, newUri: string) {

		// vue -> ts
		const tsMaped = mapper.tsUri.to(oldUri);
		if (!tsMaped)
			return;

		const tsOldUri = tsMaped.textDocument.uri;
		const tsNewUri = tsMaped.isVirtualFile ? newUri + '.ts' : newUri;
		const tsResult = tsMaped.languageService.onFileName(tsOldUri, tsNewUri);
		if (!tsResult)
			return;

		// ts -> vue
		const vueResult = tsToVue(tsResult);
		return vueResult;
	}
	function onTs(uri: string, position: Position, newName: string) {

		const loopChecker = dedupe.createLocationSet();
		const tsResult: WorkspaceEdit = {};
		let hasResult = false;

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

					if (tsWorkspaceEdit) {
						hasResult = true;
						margeWorkspaceEdits(tsResult, tsWorkspaceEdit);
					}

					if (tsWorkspaceEdit?.changes) {
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

		if (!hasResult)
			return;

		// ts -> vue
		const vueResult = tsToVue(tsResult);
		return vueResult;
	}
	function tsToVue(tsResult: WorkspaceEdit) {
		const vueResult: WorkspaceEdit = {};

		for (const tsUri in tsResult.changeAnnotations) {
			const tsAnno = tsResult.changeAnnotations[tsUri];
			const vueDoc = mapper.tsUri.from(tsUri);
			if (!vueDoc)
				continue;

			if (!vueResult.changeAnnotations)
				vueResult.changeAnnotations = {};

			vueResult.changeAnnotations[vueDoc.uri] = tsAnno;
		}
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
		if (tsResult.documentChanges) {
			for (const tsDocEdit of tsResult.documentChanges) {
				if (!vueResult.documentChanges) {
					vueResult.documentChanges = [];
				}
				let vueDocEdit: typeof tsDocEdit | undefined;
				if (TextDocumentEdit.is(tsDocEdit)) {
					const vueDoc = mapper.tsUri.from(tsDocEdit.textDocument.uri);
					if (!vueDoc)
						continue;
					const _vueDocEdit = TextDocumentEdit.create(
						{ uri: vueDoc.uri, version: vueDoc.version },
						[],
					);
					for (const tsEdit of tsDocEdit.edits) {
						for (const vueMaped of mapper.ts.from(tsDocEdit.textDocument.uri, tsEdit.range)) {
							if (
								!vueMaped.data
								|| vueMaped.data.capabilities.rename === true
								|| (typeof vueMaped.data.capabilities.rename === 'object' && vueMaped.data.capabilities.rename.out)
							) {
								_vueDocEdit.edits.push({
									annotationId: AnnotatedTextEdit.is(tsEdit) ? tsEdit.annotationId : undefined,
									newText: tsEdit.newText,
									range: vueMaped.range,
								});
							}
						}
					}
					if (_vueDocEdit.edits.length) {
						vueDocEdit = _vueDocEdit;
					}
				}
				else if (CreateFile.is(tsDocEdit)) {
					const vueDoc = mapper.tsUri.from(tsDocEdit.uri);
					if (!vueDoc)
						continue;
					vueDocEdit = CreateFile.create(vueDoc.uri, tsDocEdit.options, tsDocEdit.annotationId);
				}
				else if (RenameFile.is(tsDocEdit)) {
					const vueDoc = mapper.tsUri.from(tsDocEdit.oldUri);
					if (!vueDoc)
						continue;
					vueDocEdit = RenameFile.create(vueDoc.uri, tsDocEdit.newUri, tsDocEdit.options, tsDocEdit.annotationId);
				}
				else if (DeleteFile.is(tsDocEdit)) {
					const vueDoc = mapper.tsUri.from(tsDocEdit.uri);
					if (!vueDoc)
						continue;
					vueDocEdit = DeleteFile.create(vueDoc.uri, tsDocEdit.options, tsDocEdit.annotationId);
				}
				if (vueDocEdit) {
					vueResult.documentChanges.push(vueDocEdit);
				}
			}
		}
		return vueResult;
	}
	function onCss(uri: string, position: Position, newName: string) {

		const cssResult: WorkspaceEdit = { changes: {} };
		const vueResult: WorkspaceEdit = { changes: {} };
		let hasResult = false;

		// vue -> css
		for (const cssMaped of mapper.css.to(uri, { start: position, end: position })) {
			const cssWorkspaceEdit = cssMaped.languageService.doRename(
				cssMaped.textDocument,
				cssMaped.range.start,
				newName,
				cssMaped.stylesheet,
			);
			if (cssWorkspaceEdit) {
				hasResult = true;
				margeWorkspaceEdits(cssResult, cssWorkspaceEdit);
			}
		}

		if (!hasResult)
			return;

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

export function margeWorkspaceEdits(original: WorkspaceEdit, ...others: WorkspaceEdit[]) {
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
