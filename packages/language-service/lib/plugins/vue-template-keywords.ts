import type { CompletionItemKind, LanguageServicePlugin } from '@volar/language-service';
import type * as CompilerDOM from '@vue/compiler-dom';
import { resolveEmbeddedCode } from '../utils';

// Keywords that may appear in a single JavaScript expression
const keywords = [
	'async',
	'delete',
	'false',
	'function',
	'in',
	'instanceof',
	'new',
	'null',
	'this',
	'true',
	'typeof',
	'void',
];

/**
 * Completes JavaScript keywords at the start of an identifier in template expressions;
 * the TypeScript completion of template expressions only lists the template scope.
 */
export function create(ts: typeof import('typescript')): LanguageServicePlugin {
	return {
		name: 'vue-template-keywords',
		capabilities: {
			completionProvider: {},
		},
		create(context) {
			return {
				provideCompletionItems(document, position) {
					if (document.languageId !== 'html') {
						return;
					}
					const info = resolveEmbeddedCode(context, document.uri);
					const ast = info?.root.ir.template?.ast;
					if (info?.code.id !== 'template' || !ast) {
						return;
					}
					const offset = document.offsetAt(position);
					const start = getExpressionStartAt(ast, offset);
					if (start === undefined) {
						return;
					}
					const text = document.getText().slice(start, offset);
					const word = /[\w$]*$/.exec(text)![0];
					if (!isIdentifierStart(ts, text.slice(0, text.length - word.length))) {
						return;
					}
					const range = { start: document.positionAt(offset - word.length), end: position };
					return {
						isIncomplete: false,
						items: keywords.map(keyword => ({
							label: keyword,
							kind: 14 satisfies typeof CompletionItemKind.Keyword,
							textEdit: { range, newText: keyword },
						})),
					};
				},
			};
		},
	};
}

function isIdentifierStart(ts: typeof import('typescript'), textBefore: string) {
	const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, textBefore);
	let kind = scanner.scan();
	let last: import('typescript').SyntaxKind | undefined;
	let lastEnd = 0;
	while (kind !== ts.SyntaxKind.EndOfFileToken) {
		last = kind;
		lastEnd = scanner.getTokenEnd();
		kind = scanner.scan();
	}
	if (last === undefined) {
		return true;
	}
	if (
		lastEnd === textBefore.length && (
			last === ts.SyntaxKind.StringLiteral
			|| last === ts.SyntaxKind.NoSubstitutionTemplateLiteral
			|| last === ts.SyntaxKind.SingleLineCommentTrivia
			|| last === ts.SyntaxKind.MultiLineCommentTrivia
		)
	) {
		return false;
	}
	return last !== ts.SyntaxKind.DotToken
		&& last !== ts.SyntaxKind.QuestionDotToken
		&& last !== ts.SyntaxKind.NumericLiteral;
}

function getExpressionStartAt(
	node: CompilerDOM.RootNode | CompilerDOM.TemplateChildNode,
	offset: number,
): number | undefined {
	if (offset < node.loc.start.offset || offset > node.loc.end.offset) {
		return;
	}
	switch (node.type) {
		case 5 satisfies CompilerDOM.NodeTypes.INTERPOLATION: {
			if (offset >= node.loc.start.offset + 2 && offset <= node.loc.end.offset - 2) {
				return node.loc.start.offset + 2;
			}
			return;
		}
		case 9 satisfies CompilerDOM.NodeTypes.IF: {
			for (const branch of node.branches) {
				const start = getExpressionStartAt(branch, offset);
				if (start !== undefined) {
					return start;
				}
			}
			return;
		}
		case 10 satisfies CompilerDOM.NodeTypes.IF_BRANCH:
		case 11 satisfies CompilerDOM.NodeTypes.FOR:
		case 1 satisfies CompilerDOM.NodeTypes.ELEMENT:
		case 0 satisfies CompilerDOM.NodeTypes.ROOT: {
			const expressions: CompilerDOM.ExpressionNode[] = [];
			if (node.type === 10 satisfies CompilerDOM.NodeTypes.IF_BRANCH && node.condition) {
				expressions.push(node.condition);
			}
			if (node.type === 11 satisfies CompilerDOM.NodeTypes.FOR) {
				expressions.push(node.parseResult.source);
			}
			if (node.type === 1 satisfies CompilerDOM.NodeTypes.ELEMENT) {
				for (const prop of node.props) {
					if (prop.type !== 7 satisfies CompilerDOM.NodeTypes.DIRECTIVE) {
						continue;
					}
					if (
						prop.arg && !(prop.arg.type === 4 satisfies CompilerDOM.NodeTypes.SIMPLE_EXPRESSION && prop.arg.isStatic)
					) {
						expressions.push(prop.arg);
					}
					// v-slot values are parameters; the v-for source is on the FOR node
					if (prop.exp && prop.name !== 'slot' && prop.name !== 'for') {
						expressions.push(prop.exp);
					}
				}
			}
			for (const expression of expressions) {
				if (offset >= expression.loc.start.offset && offset <= expression.loc.end.offset) {
					return expression.loc.start.offset;
				}
			}
			for (const child of node.children) {
				const start = getExpressionStartAt(child, offset);
				if (start !== undefined) {
					return start;
				}
			}
			return;
		}
	}
}
