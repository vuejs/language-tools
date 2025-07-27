import type { InsertTextFormat, LanguageServicePlugin, WorkspaceEdit } from '@volar/language-service';
import { forEachEmbeddedCode } from '@vue/language-core';
import { camelize, capitalize, hyphenate } from '@vue/shared';
import { posix as path } from 'path-browserify';
import { getUserPreferences } from 'volar-service-typescript/lib/configs/getUserPreferences';
import { URI } from 'vscode-uri';
import { checkCasing, TagNameCasing } from '../nameCasing';
import { createAddComponentToOptionEdit, getLastImportNode } from '../plugins/vue-extract-file';
import { getEmbeddedInfo } from '../utils';

export function create(
	ts: typeof import('typescript'),
	{ getImportPathForFile }: import('@vue/typescript-plugin/lib/requests').Requests,
): LanguageServicePlugin {
	return {
		name: 'vue-document-drop',
		capabilities: {
			documentDropEditsProvider: true,
		},
		create(context) {
			return {
				async provideDocumentDropEdits(document, _position, dataTransfer) {
					const info = getEmbeddedInfo(context, document, 'template', 'html');
					if (!info) {
						return;
					}
					const { sourceScript, root } = info;

					let importUri: string | undefined;
					for (const [mimeType, item] of dataTransfer) {
						if (mimeType === 'text/uri-list') {
							importUri = item.value as string;
						}
					}
					if (!importUri || !root.vueCompilerOptions.extensions.some(ext => importUri.endsWith(ext))) {
						return;
					}

					const { sfc } = root;
					const script = sfc.scriptSetup ?? sfc.script;
					if (!script) {
						return;
					}

					const casing = await checkCasing(context, sourceScript.id);
					const baseName = path.basename(importUri);
					const newName = capitalize(camelize(baseName.slice(0, baseName.lastIndexOf('.'))));

					const additionalEdit: WorkspaceEdit = {};
					const code = [...forEachEmbeddedCode(root)].find(code =>
						code.id === (sfc.scriptSetup ? 'scriptsetup_raw' : 'script_raw')
					)!;
					const lastImportNode = getLastImportNode(ts, script.ast);
					const incomingFileName = URI.parse(importUri).fsPath.replace(/\\/g, '/');

					let importPath: string | undefined;

					const serviceScript = sourceScript.generated.languagePlugin.typescript?.getServiceScript(root);
					if (serviceScript) {
						const tsDocumentUri = context.encodeEmbeddedDocumentUri(sourceScript.id, serviceScript.code.id);
						const tsDocument = context.documents.get(
							tsDocumentUri,
							serviceScript.code.languageId,
							serviceScript.code.snapshot,
						);
						const preferences = await getUserPreferences(context, tsDocument);
						importPath = (
							await getImportPathForFile(
								root.fileName,
								incomingFileName,
								preferences,
							) ?? {}
						).path;
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
						range: lastImportNode
							? {
								start: script.ast.getLineAndCharacterOfPosition(lastImportNode.end),
								end: script.ast.getLineAndCharacterOfPosition(lastImportNode.end),
							}
							: {
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
						insertText: `<${casing.tag === TagNameCasing.Kebab ? hyphenate(newName) : newName}$0 />`,
						insertTextFormat: 2 satisfies typeof InsertTextFormat.Snippet,
						additionalEdit,
					};
				},
			};
		},
	};
}
