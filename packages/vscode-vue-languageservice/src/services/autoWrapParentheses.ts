import type { HtmlLanguageServiceContext } from '../types';
import type * as vscode from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';

export function register({ typescript: ts, getVueDocument }: HtmlLanguageServiceContext) {

	return (document: TextDocument, position: vscode.Position): { text: string, range: vscode.Range } | undefined | null => {

		const soureFile = getVueDocument(document);
		if (!soureFile)
			return;

		const templateFormatScript = soureFile.getTemplateFormattingScript();
		if (!templateFormatScript.document || !templateFormatScript.sourceMap)
			return;

		const offset = document.offsetAt(position);

		for (const mapedRange of templateFormatScript.sourceMap.mappings) {
			if (mapedRange.sourceRange.end === offset) {
				const text = document.getText().substring(mapedRange.sourceRange.start, mapedRange.sourceRange.end);
				const ast = ts.createSourceFile(templateFormatScript.document.uri, text, ts.ScriptTarget.Latest);
				if (ast.statements.length === 1) {
					const statement = ast.statements[0];
					if (
						ts.isExpressionStatement(statement)
						&& ts.isAsExpression(statement.expression)
						&& ts.isTypeReferenceNode(statement.expression.type)
						&& ts.isIdentifier(statement.expression.type.typeName)
						&& statement.expression.type.typeName.text
					) {
						return {
							text: '(' + text + '$0' + ')',
							range: {
								start: document.positionAt(mapedRange.sourceRange.start),
								end: document.positionAt(mapedRange.sourceRange.end),
							},
						};
					}
				}
			}
		}
	}
}
