import { VueVirtualCode, forEachEmbeddedCode } from '@vue/language-core';
import { camelize, capitalize, hyphenate } from '@vue/shared';
import { posix as path } from 'path-browserify';
import { getUserPreferences } from 'volar-service-typescript/lib/configs/getUserPreferences';
import type * as vscode from 'vscode-languageserver-protocol';
import { URI } from 'vscode-uri';
import { createAddComponentToOptionEdit, getLastImportNode } from '../plugins/vue-extract-file';
import { LanguageServiceContext, LanguageServicePlugin, TagNameCasing } from '../types';

export function create(
	ts: typeof import('typescript'),
	getTsPluginClient?: (context: LanguageServiceContext) => typeof import('@vue/typescript-plugin/lib/client') | undefined
): LanguageServicePlugin {
	return {
		name: 'vue-document-drop',
		capabilities: {
			documentDropEditsProvider: true,
		},
		create(context) {
			if (!context.project.vue) {
				return {};
			}

			let casing = TagNameCasing.Pascal as TagNameCasing; // TODO

			const tsPluginClient = getTsPluginClient?.(context);
			const vueCompilerOptions = context.project.vue.compilerOptions;

			return {
				async provideDocumentDropEdits(document, _position, dataTransfer) {

					if (document.languageId !== 'html') {
						return;
					}

					const uri = URI.parse(document.uri);
					const decoded = context.decodeEmbeddedDocumentUri(uri);
					const sourceScript = decoded && context.language.scripts.get(decoded[0]);
					if (!sourceScript?.generated) {
						return;
					}

					const root = sourceScript.generated.root;
					if (!(root instanceof VueVirtualCode)) {
						return;
					}

					let importUri: string | undefined;
					for (const [mimeType, item] of dataTransfer) {
						if (mimeType === 'text/uri-list') {
							importUri = item.value as string;
						}
					}
					if (!importUri || !vueCompilerOptions.extensions.some(ext => importUri.endsWith(ext))) {
						return;
					}

					const { sfc } = root;
					const script = sfc.scriptSetup ?? sfc.script;
					if (!script) {
						return;
					}

					let baseName = importUri.slice(importUri.lastIndexOf('/') + 1);
					baseName = baseName.slice(0, baseName.lastIndexOf('.'));
					const newName = capitalize(camelize(baseName));

					const additionalEdit: vscode.WorkspaceEdit = {};
					const code = [...forEachEmbeddedCode(root)].find(code => code.id === (sfc.scriptSetup ? 'scriptsetup_raw' : 'script_raw'))!;
					const lastImportNode = getLastImportNode(ts, script.ast);
					const incomingFileName = context.project.typescript?.uriConverter.asFileName(URI.parse(importUri))
						?? URI.parse(importUri).fsPath.replace(/\\/g, '/');

					let importPath: string | undefined;

					const serviceScript = sourceScript.generated?.languagePlugin.typescript?.getServiceScript(root);
					if (tsPluginClient && serviceScript) {
						const tsDocumentUri = context.encodeEmbeddedDocumentUri(sourceScript.id, serviceScript.code.id);
						const tsDocument = context.documents.get(tsDocumentUri, serviceScript.code.languageId, serviceScript.code.snapshot);
						const preferences = await getUserPreferences(context, tsDocument);
						const importPathRequest = await tsPluginClient.getImportPathForFile(root.fileName, incomingFileName, preferences);
						if (importPathRequest) {
							importPath = importPathRequest;
						}
					}

					if (!importPath) {
						importPath = path.relative(path.dirname(root.fileName), incomingFileName)
							|| importUri.slice(importUri.lastIndexOf('/') + 1);

						if (!importPath.startsWith('./') && !importPath.startsWith('../')) {
							importPath = './' + importPath;
						}
					}

					const embeddedDocumentUriStr = context.encodeEmbeddedDocumentUri(sourceScript.id, code.id).toString();

					additionalEdit.changes ??= {};
					additionalEdit.changes[embeddedDocumentUriStr] = [];
					additionalEdit.changes[embeddedDocumentUriStr].push({
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
						const edit = createAddComponentToOptionEdit(ts, sfc, sfc.script.ast, newName);
						if (edit) {
							additionalEdit.changes[embeddedDocumentUriStr].push({
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
