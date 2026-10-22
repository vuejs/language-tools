import type { InsertTextFormat, LanguageServicePlugin, TextEdit } from '@volar/language-service';
import { getAllExtensions } from '@vue/language-core';
import { hyphenate } from '@vue/shared';
import { URI } from 'vscode-uri';
import { getTagNameCasing, TagNameCasing } from '../nameCasing';
import { createAddComponentToOptionEdit } from '../plugins/vue-extract-file';
import { resolveEmbeddedCode } from '../utils';

export function create(
	ts: typeof import('typescript'),
	{ getDefaultImportEdits }: import('@vue/typescript-plugin/lib/requests').Requests,
): LanguageServicePlugin {
	return {
		name: 'vue-document-drop',
		capabilities: {
			documentDropEditsProvider: true,
		},
		create(context) {
			return {
				async provideDocumentDropEdits(document, _position, dataTransfer) {
					if (document.languageId !== 'html') {
						return;
					}
					const info = resolveEmbeddedCode(context, document.uri);
					if (info?.code.id !== 'template') {
						return;
					}

					let importUri: string | undefined;
					for (const [mimeType, item] of dataTransfer) {
						if (mimeType === 'text/uri-list') {
							importUri = item.value as string;
						}
					}
					if (!importUri || !getAllExtensions(info.root.vueCompilerOptions).some(ext => importUri.endsWith(ext))) {
						return;
					}

					const { ir } = info.root;
					if (!ir.scriptSetup && !ir.script) {
						return;
					}

					const incomingFileName = URI.parse(importUri).fsPath.replace(/\\/g, '/');
					const importEdits = await getDefaultImportEdits(info.root.fileName, incomingFileName);
					const name = importEdits && getDefaultImportName(ts, importEdits);
					if (!importEdits || !name) {
						return;
					}

					const sfcDocument = context.documents.get(info.script.id, info.script.languageId, info.script.snapshot);
					const sfcEdits: TextEdit[] = importEdits.map(edit => ({
						range: {
							start: sfcDocument.positionAt(edit.pos),
							end: sfcDocument.positionAt(edit.end),
						},
						newText: edit.newText,
					}));

					if (ir.script) {
						const edit = createAddComponentToOptionEdit(ts, ir, ir.script.ast, name);
						if (edit) {
							sfcEdits.push({
								range: {
									start: sfcDocument.positionAt(ir.script.startTagEnd + edit.range.start),
									end: sfcDocument.positionAt(ir.script.startTagEnd + edit.range.end),
								},
								newText: edit.newText,
							});
						}
					}

					const tagNameCasing = await getTagNameCasing(context, info.script.id);

					return {
						insertText: `<${tagNameCasing === TagNameCasing.Kebab ? hyphenate(name) : name}$0 />`,
						insertTextFormat: 2 satisfies typeof InsertTextFormat.Snippet,
						additionalEdit: { changes: { [sfcDocument.uri]: sfcEdits } },
					};
				},
			};
		},
	};
}

/** The local name of the default import the TypeScript language server's edits add. */
function getDefaultImportName(ts: typeof import('typescript'), edits: readonly { newText: string }[]) {
	for (const { newText } of edits) {
		const ast = ts.createSourceFile('drop.ts', newText, ts.ScriptTarget.Latest);
		for (const statement of ast.statements) {
			if (ts.isImportDeclaration(statement) && statement.importClause?.name) {
				return statement.importClause.name.text;
			}
		}
	}
}
