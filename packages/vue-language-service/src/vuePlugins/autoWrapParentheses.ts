import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as vscode from 'vscode-languageserver-protocol';
import { EmbeddedLanguageServicePlugin, useConfigurationHost } from '@volar/vue-language-service-types';
import { isCharacterTyping } from './autoCompleteRefs';
import { VueDocument } from '../vueDocuments';

export default function (options: {
	ts: typeof import('typescript/lib/tsserverlibrary'),
	getVueDocument: (document: TextDocument) => VueDocument | undefined,
}): EmbeddedLanguageServicePlugin {

	return {

		async doAutoInsert(document, position, options_2) {

			const enabled = await useConfigurationHost()?.getConfiguration<boolean>('volar.autoWrapParentheses') ?? true;
			if (!enabled)
				return;

			if (!isCharacterTyping(document, options_2))
				return;

			const vueDocument = options.getVueDocument(document);
			if (!vueDocument)
				return;

			const templateFormatScript = vueDocument.file.getTemplateFormattingScript();
			if (!templateFormatScript)
				return;

			const offset = document.offsetAt(position);

			for (const mappedRange of templateFormatScript.sourceMap.mappings) {
				if (mappedRange.sourceRange.end === offset) {
					const text = document.getText().substring(mappedRange.sourceRange.start, mappedRange.sourceRange.end);
					const ast = options.ts.createSourceFile(templateFormatScript.file.fileName, text, options.ts.ScriptTarget.Latest);
					if (ast.statements.length === 1) {
						const statement = ast.statements[0];
						if (
							options.ts.isExpressionStatement(statement)
							&& options.ts.isAsExpression(statement.expression)
							&& options.ts.isTypeReferenceNode(statement.expression.type)
							&& options.ts.isIdentifier(statement.expression.type.typeName)
							&& statement.expression.type.typeName.text
						) {
							return vscode.TextEdit.replace(
								{
									start: document.positionAt(mappedRange.sourceRange.start),
									end: document.positionAt(mappedRange.sourceRange.end),
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
