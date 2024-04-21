import { VueVirtualCode, forEachEmbeddedCode } from '@vue/language-core';
import { camelize, capitalize, hyphenate } from '@vue/shared';
import * as path from 'path-browserify';
import type * as vscode from 'vscode-languageserver-protocol';
import { createAddComponentToOptionEdit, getLastImportNode } from '../plugins/vue-extract-file';
import { LanguageServicePlugin, LanguageServicePluginInstance, ServiceContext, TagNameCasing } from '../types';
import { getUserPreferences } from 'volar-service-typescript/lib/configs/getUserPreferences';

export function create(
	ts: typeof import('typescript'),
	getTsPluginClient?: (context: ServiceContext) => typeof import('@vue/typescript-plugin/lib/client') | undefined,
): LanguageServicePlugin {
	return {
		name: 'vue-document-drop',
		create(context): LanguageServicePluginInstance {

			let casing: TagNameCasing = TagNameCasing.Pascal; // TODO

			const tsPluginClient = getTsPluginClient?.(context);

			return {
				async provideDocumentDropEdits(document, _position, dataTransfer) {

					if (document.languageId !== 'html') {
						return;
					}

					const decoded = context.decodeEmbeddedDocumentUri(document.uri);
					const sourceScript = decoded && context.language.scripts.get(decoded[0]);
					const virtualCode = decoded && sourceScript?.generated?.embeddedCodes.get(decoded[1]);
					const vueVirtualCode = sourceScript?.generated?.root;
					if (!sourceScript || !virtualCode || !(vueVirtualCode instanceof VueVirtualCode)) {
						return;
					}

					let importUri: string | undefined;
					for (const [mimeType, item] of dataTransfer) {
						if (mimeType === 'text/uri-list') {
							importUri = item.value as string;
						}
					}
					if (!importUri?.endsWith('.vue')) {
						return;
					}

					let baseName = importUri.substring(importUri.lastIndexOf('/') + 1);
					baseName = baseName.substring(0, baseName.lastIndexOf('.'));

					const newName = capitalize(camelize(baseName));
					const { sfc } = vueVirtualCode;
					const script = sfc.scriptSetup ?? sfc.script;

					if (!script) {
						return;
					}

					const additionalEdit: vscode.WorkspaceEdit = {};
					const code = [...forEachEmbeddedCode(vueVirtualCode)].find(code => code.id === (sfc.scriptSetup ? 'scriptSetupFormat' : 'scriptFormat'))!;
					const lastImportNode = getLastImportNode(ts, script.ast);
					const incomingFileName = context.env.typescript!.uriToFileName(importUri);

					let importPath: string | undefined;

					const serviceScript = sourceScript.generated?.languagePlugin.typescript?.getServiceScript(vueVirtualCode);
					if (tsPluginClient && serviceScript) {
						const tsDocumentUri = context.encodeEmbeddedDocumentUri(sourceScript.id, serviceScript.code.id);
						const tsDocument = context.documents.get(tsDocumentUri, serviceScript.code.languageId, serviceScript.code.snapshot);
						const preferences = await getUserPreferences(context, tsDocument);
						const importPathRequest = await tsPluginClient.getImportPathForFile(vueVirtualCode.fileName, incomingFileName, preferences);
						if (importPathRequest) {
							importPath = importPathRequest;
						}
					}

					if (!importPath) {
						importPath = path.relative(path.dirname(vueVirtualCode.fileName), incomingFileName)
							|| importUri.substring(importUri.lastIndexOf('/') + 1);

						if (!importPath.startsWith('./') && !importPath.startsWith('../')) {
							importPath = './' + importPath;
						}
					}

					additionalEdit.changes ??= {};
					additionalEdit.changes[context.encodeEmbeddedDocumentUri(sourceScript.id, code.id)] = [];
					additionalEdit.changes[context.encodeEmbeddedDocumentUri(sourceScript.id, code.id)].push({
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
							additionalEdit.changes[context.encodeEmbeddedDocumentUri(sourceScript.id, code.id)].push({
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
