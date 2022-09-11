import type { TextDocument } from 'vscode-languageserver-textdocument';
import * as vscode from 'vscode-languageserver-protocol';
import { EmbeddedLanguageServicePlugin, useConfigurationHost, useTypeScriptModule, SourceFileDocument } from '@volar/language-service';
import { isCharacterTyping } from './vue-autoinsert-dotvalue';
import * as embedded from '@volar/language-core';
import { FileNode } from '@volar/language-core';

export default function (options: {
	getVueDocument: (document: TextDocument) => SourceFileDocument | undefined,
}): EmbeddedLanguageServicePlugin {

	const ts = useTypeScriptModule();

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


			let templateFormatScript: FileNode | undefined;

			embedded.forEachEmbeddeds(vueDocument.file, embedded => {
				if (embedded.fileName.endsWith('.__VLS_template_format.tsx')
					|| embedded.fileName.endsWith('.__VLS_template_format.jsx')) {
					templateFormatScript = embedded;
				}
			});

			if (!templateFormatScript)
				return;

			const offset = document.offsetAt(position);

			for (const mappedRange of templateFormatScript.mappings) {
				if (mappedRange.sourceRange.end === offset) {
					const text = document.getText().substring(mappedRange.sourceRange.start, mappedRange.sourceRange.end);
					const ast = ts.createSourceFile(templateFormatScript.fileName, text, ts.ScriptTarget.Latest);
					if (ast.statements.length === 1) {
						const statement = ast.statements[0];
						if (
							ts.isExpressionStatement(statement)
							&& ts.isAsExpression(statement.expression)
							&& ts.isTypeReferenceNode(statement.expression.type)
							&& ts.isIdentifier(statement.expression.type.typeName)
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
	};
}
