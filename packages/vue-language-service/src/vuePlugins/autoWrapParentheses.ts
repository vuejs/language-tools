import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as vscode from 'vscode-languageserver-protocol';
import { EmbeddedLanguagePlugin } from '@volar/vue-language-service-types';
import { VueDocument } from '@volar/vue-typescript';
import { isCharacterTyping } from './autoCompleteRefs';
import * as shared from '@volar/shared';

export default function (host: {
	getSettings: <S>(section: string, scopeUri?: string | undefined) => Promise<S | undefined>,
	ts: typeof import('typescript/lib/tsserverlibrary'),
	getVueDocument: (document: TextDocument) => VueDocument | undefined,
}): EmbeddedLanguagePlugin {

	return {

		async doAutoInsert(document, position, options) {

			const enabled = await host.getSettings<boolean>('volar.autoWrapParentheses') ?? true;
			if (!enabled)
				return;

			if (!isCharacterTyping(document, options))
				return;

			const vueDocument = host.getVueDocument(document);
			if (!vueDocument)
				return;

			const templateFormatScript = vueDocument.getTemplateFormattingScript();
			if (!templateFormatScript.document || !templateFormatScript.sourceMap)
				return;

			const offset = document.offsetAt(position);

			for (const mapedRange of templateFormatScript.sourceMap.mappings) {
				if (mapedRange.sourceRange.end === offset) {
					const text = document.getText().substring(mapedRange.sourceRange.start, mapedRange.sourceRange.end);
					const ast = host.ts.createSourceFile(shared.uriToFsPath(templateFormatScript.document.uri), text, host.ts.ScriptTarget.Latest);
					if (ast.statements.length === 1) {
						const statement = ast.statements[0];
						if (
							host.ts.isExpressionStatement(statement)
							&& host.ts.isAsExpression(statement.expression)
							&& host.ts.isTypeReferenceNode(statement.expression.type)
							&& host.ts.isIdentifier(statement.expression.type.typeName)
							&& statement.expression.type.typeName.text
						) {
							return vscode.TextEdit.replace(
								{
									start: document.positionAt(mapedRange.sourceRange.start),
									end: document.positionAt(mapedRange.sourceRange.end),
								},
								'(' + text + '$0' + ')',
							);
						}
					}
				}
			}
		},
	}
}
