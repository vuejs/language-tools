import { VueGeneratedCode, forEachEmbeddedCode } from '@vue/language-core';
import { camelize, capitalize, hyphenate } from '@vue/shared';
import * as path from 'path-browserify';
import type * as vscode from 'vscode-languageserver-protocol';
import { createAddComponentToOptionEdit, getLastImportNode } from '../plugins/vue-extract-file';
import { ServicePlugin, ServicePluginInstance, TagNameCasing } from '../types';

export function create(ts: typeof import('typescript/lib/tsserverlibrary')): ServicePlugin {
	return {
		name: 'vue-document-drop',
		create(context): ServicePluginInstance {

			let casing: TagNameCasing = TagNameCasing.Pascal; // TODO

			return {
				async provideDocumentDropEdits(document, _position, dataTransfer) {

					if (document.languageId !== 'html')
						return;

					const [virtualCode, sourceFile] = context.documents.getVirtualCodeByUri(document.uri);
					const vueVirtualCode = sourceFile?.generated?.code;
					if (!virtualCode || !(vueVirtualCode instanceof VueGeneratedCode))
						return;

					let importUri: string | undefined;
					for (const [mimeType, item] of dataTransfer) {
						if (mimeType === 'text/uri-list') {
							importUri = item.value as string;
						}
					}
					if (!importUri?.endsWith('.vue'))
						return;

					let baseName = importUri.substring(importUri.lastIndexOf('/') + 1);
					baseName = baseName.substring(0, baseName.lastIndexOf('.'));

					const newName = capitalize(camelize(baseName));
					const { sfc } = vueVirtualCode;
					const script = sfc.scriptSetup ?? sfc.script;

					if (!script)
						return;

					const additionalEdit: vscode.WorkspaceEdit = {};
					const code = [...forEachEmbeddedCode(vueVirtualCode)].find(code => code.id === (sfc.scriptSetup ? 'scriptSetupFormat' : 'scriptFormat'))!;
					const lastImportNode = getLastImportNode(ts, script.ast);

					let importPath = path.relative(path.dirname(document.uri), importUri)
						|| importUri.substring(importUri.lastIndexOf('/') + 1);

					if (!importPath.startsWith('./') && !importPath.startsWith('../')) {
						importPath = './' + importPath;
					}

					additionalEdit.changes ??= {};
					additionalEdit.changes[context.documents.getVirtualCodeUri(sourceFile.id, code.id)] = [];
					additionalEdit.changes[context.documents.getVirtualCodeUri(sourceFile.id, code.id)].push({
						range: lastImportNode ? {
							start: script.ast.getLineAndCharacterOfPosition(lastImportNode.end),
							end: script.ast.getLineAndCharacterOfPosition(lastImportNode.end),
						} : {
							start: script.ast.getLineAndCharacterOfPosition(0),
							end: script.ast.getLineAndCharacterOfPosition(0),
						},
						newText: `\nimport ${newName} from '${importPath}'`
							+ (lastImportNode ? '' : '\n'),
					});

					if (sfc.script) {
						const edit = createAddComponentToOptionEdit(ts, sfc.script.ast, newName);
						if (edit) {
							additionalEdit.changes[context.documents.getVirtualCodeUri(sourceFile.id, code.id)].push({
								range: {
									start: document.positionAt(edit.range.start),
									end: document.positionAt(edit.range.end),
								},
								newText: edit.newText,
							});
						}
					}

					return {
						insertText: `<${casing === TagNameCasing.Kebab ? hyphenate(newName) : newName}$0 />`,
						insertTextFormat: 2 satisfies typeof vscode.InsertTextFormat.Snippet,
						additionalEdit,
					};
				},
			};
		},
	};
}
