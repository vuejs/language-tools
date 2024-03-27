import type { LanguageServicePlugin, LanguageServicePluginInstance } from '@volar/language-service';
import { isCharacterTyping } from './vue-autoinsert-dotvalue';

export function create(ts: typeof import('typescript')): LanguageServicePlugin {
	return {
		name: 'vue-autoinsert-parentheses',
		create(context): LanguageServicePluginInstance {
			return {
				async provideAutoInsertionEdit(document, position, lastChange) {

					const enabled = await context.env.getConfiguration?.<boolean>('vue.autoInsert.parentheses') ?? false;
					if (!enabled) {
						return;
					}

					if (!isCharacterTyping(document, lastChange)) {
						return;
					}

					const decoded = context.decodeEmbeddedDocumentUri(document.uri);
					const sourceScript = decoded && context.language.scripts.get(decoded[0]);
					const virtualCode = decoded && sourceScript?.generated?.embeddedCodes.get(decoded[1]);
					if (!virtualCode?.id.startsWith('template_inline_ts_')) {
						return;
					}

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
