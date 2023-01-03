import * as vscode from 'vscode-languageserver-protocol';
import { isCharacterTyping } from './vue-autoinsert-dotvalue';
import * as embedded from '@volar/language-core';
import { VirtualFile } from '@volar/language-core';
import { VueFile } from '@volar/vue-language-core';
import { VueLanguageServicePlugin } from '../types';

const plugin: VueLanguageServicePlugin = (context) => {

	if (!context.typescript) {
		return {};
	}

	const ts = context.typescript.module;

	return {

		async doAutoInsert(document, position, options_2) {

			const enabled = await context.env.configurationHost?.getConfiguration<boolean>('volar.autoWrapParentheses') ?? false;
			if (!enabled)
				return;

			if (!isCharacterTyping(document, options_2))
				return;

			const vueFile = context.documents.getVirtualFileByUri(document.uri);
			if (!(vueFile instanceof VueFile))
				return;

			let templateFormatScript: VirtualFile | undefined;

			embedded.forEachEmbeddedFile(vueFile, embedded => {
				if (embedded.fileName.endsWith('.__VLS_template_format.ts')) {
					templateFormatScript = embedded;
				}
			});

			if (!templateFormatScript)
				return;

			const offset = document.offsetAt(position);

			for (const mappedRange of templateFormatScript.mappings) {
				if (mappedRange.sourceRange[1] === offset) {
					const text = document.getText().substring(mappedRange.sourceRange[0], mappedRange.sourceRange[1]);
					const ast = ts.createSourceFile(templateFormatScript.fileName, text, ts.ScriptTarget.Latest);
					if (ast.statements.length === 1) {
						const statement = ast.statements[0];
						if (
							ts.isExpressionStatement(statement)
							&& (
								(
									ts.isAsExpression(statement.expression)
									&& ts.isTypeReferenceNode(statement.expression.type)
									&& ts.isIdentifier(statement.expression.type.typeName)
									&& statement.expression.type.typeName.text
								)
								|| (
									ts.isBinaryExpression(statement.expression)
									&& statement.expression.right.getText(ast)
									&& statement.expression.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword
								)
								|| (
									ts.isTypeOfExpression(statement.expression)
									&& statement.expression.expression.getText(ast)
								)
							)
						) {
							// https://code.visualstudio.com/docs/editor/userdefinedsnippets#_grammar
							const escapedText = text
								.replaceAll('\\', '\\\\')
								.replaceAll('$', '\\$')
								.replaceAll('}', '\\}');
							return vscode.TextEdit.replace(
								{
									start: document.positionAt(mappedRange.sourceRange[0]),
									end: document.positionAt(mappedRange.sourceRange[1]),
								},
								'(' + escapedText + '$0' + ')',
							);
						}
					}
				}
			}
		},
	};
};

export default () => plugin;
