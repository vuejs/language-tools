import type { ServicePlugin, ServicePluginInstance } from '@volar/language-service';
import { isCharacterTyping } from './vue-autoinsert-dotvalue';

export function create(ts: typeof import('typescript')): ServicePlugin {
	return {
		name: 'vue-autoinsert-parentheses',
		create(context): ServicePluginInstance {
			return {
				async provideAutoInsertionEdit(document, position, lastChange) {

					const enabled = await context.env.getConfiguration?.<boolean>('vue.autoInsert.parentheses') ?? false;
					if (!enabled)
						return;

					if (!isCharacterTyping(document, lastChange))
						return;

					const [virtualCode] = context.documents.getVirtualCodeByUri(document.uri);
					if (virtualCode?.id !== 'template_format')
						return;

					const offset = document.offsetAt(position);

					for (const mappedRange of virtualCode.mappings) {
						const generatedCodeEnd = mappedRange.generatedOffsets[mappedRange.generatedOffsets.length - 1]
							+ mappedRange.lengths[mappedRange.lengths.length - 1];
						if (generatedCodeEnd === offset) {
							const text = document.getText().substring(mappedRange.generatedOffsets[0], generatedCodeEnd);
							const ast = ts.createSourceFile('', text, ts.ScriptTarget.Latest);
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
											start: document.positionAt(mappedRange.generatedOffsets[0]),
											end: document.positionAt(generatedCodeEnd),
										},
										newText: '(' + escapedText + '$0' + ')',
									};
								}
							}
						}
					}
				},
			};
		},
	};
}
