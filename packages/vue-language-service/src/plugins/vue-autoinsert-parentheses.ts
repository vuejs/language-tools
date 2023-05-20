import * as embedded from '@volar/language-core';
import { VirtualFile } from '@volar/language-core';
import { Service } from '@volar/language-service';
import { VueFile } from '@vue/language-core';
import { isCharacterTyping } from './vue-autoinsert-dotvalue';

const plugin: Service = (context, modules) => {

	if (!context) {
		return {};
	}

	if (!modules?.typescript) {
		return {};
	}

	const ts = modules.typescript;

	return {

		async provideAutoInsertionEdit(document, position, options_2) {

			const enabled = await context.env.getConfiguration?.<boolean>('vue.autoInsert.parentheses') ?? false;
			if (!enabled)
				return;

			if (!isCharacterTyping(document, options_2))
				return;

			const [vueFile] = context.documents.getVirtualFileByUri(document.uri);
			if (!(vueFile instanceof VueFile))
				return;

			let templateFormatScript: VirtualFile | undefined;

			embedded.forEachEmbeddedFile(vueFile, embedded => {
				if (embedded.fileName.endsWith('.template_format.ts')) {
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
							return {
								range: {
									start: document.positionAt(mappedRange.sourceRange[1]),
									end: document.positionAt(mappedRange.sourceRange[1]),
								},
								newText: '(' + escapedText + '$0' + ')',
							};
						}
					}
				}
			}
		},
	};
};

export default () => plugin;
