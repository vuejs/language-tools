import { Service } from '@volar/language-service';
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

			const [virtualFile] = context.documents.getVirtualFileByUri(document.uri);
			if (!virtualFile?.fileName.endsWith('.template_format.ts'))
				return;

			const offset = document.offsetAt(position);

			for (const mappedRange of virtualFile.mappings) {
				if (mappedRange.generatedRange[1] === offset) {
					const text = document.getText().substring(mappedRange.generatedRange[0], mappedRange.generatedRange[1]);
					const ast = ts.createSourceFile(virtualFile.fileName, text, ts.ScriptTarget.Latest);
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
									start: document.positionAt(mappedRange.generatedRange[0]),
									end: document.positionAt(mappedRange.generatedRange[1]),
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
