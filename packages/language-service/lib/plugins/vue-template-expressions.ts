import {
	type CompletionItem,
	type CompletionItemKind,
	type LanguageServicePlugin,
	transformCompletionItem,
} from '@volar/language-service';
import { getSourceRange } from '@volar/language-service/lib/utils/featureWorkers';
import type * as CompilerDOM from '@vue/compiler-dom';
import { collectBindingNames, tsCodegen } from '@vue/language-core';
import { parseVForNode } from '@vue/language-core/lib/codegen/template/vFor';
import { URI } from 'vscode-uri';
import type { AutoImportExport } from '../requests';
import { asCoreTypeScript, resolveEmbeddedCode } from '../utils';

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

interface AutoImportData {
	__vue__autoImportValue: {
		uri: string;
		fileName: string;
		entry: AutoImportExport;
	};
}

/**
 * Completes, at the start of an identifier in template expressions, the JavaScript keywords, the setup bindings and
 * template locals in scope, and the not yet imported value exports of the project. The TypeScript completion of
 * template expressions lists only the template scope, which names a binding or local once the template uses it.
 */
export function create(
	ts: typeof import('typescript'),
	{ getAutoImportValues, getComponentImportEdits }: import('../requests').Requests,
): LanguageServicePlugin {
	return {
		name: 'vue-template-expressions',
		capabilities: {
			completionProvider: {
				resolveProvider: true,
			},
		},
		create(context) {
			const resolvedItems = new WeakSet<CompletionItem>();

			return {
				async provideCompletionItems(document, position) {
					if (document.languageId !== 'html') {
						return;
					}
					const info = resolveEmbeddedCode(context, document.uri);
					const ast = info?.root.ir.template?.ast;
					if (info?.code.id !== 'template' || !ast) {
						return;
					}
					const offset = document.offsetAt(position);
					const locals: string[] = [];
					const start = getExpressionStartAt(ts, ast, offset, locals);
					if (start === undefined) {
						return;
					}
					const text = document.getText().slice(start, offset);
					const word = /[\w$]*$/.exec(text)![0];
					if (!isIdentifierStart(ts, text.slice(0, text.length - word.length))) {
						return;
					}
					const range = { start: document.positionAt(offset - word.length), end: position };
					const items: CompletionItem[] = keywords.map(keyword => ({
						label: keyword,
						kind: 14 satisfies typeof CompletionItemKind.Keyword,
						textEdit: { range, newText: keyword },
					}));
					const codegen = tsCodegen.get(info.root.ir);
					const bindings = info.root.scriptAnalysis.getSetupBindings();
					const listed = new Set([
						...codegen?.getScopeBindings() ?? [],
						...codegen?.getGeneratedTemplate()?.scopeMemberNames ?? [],
						...keywords,
						...Object.values(info.root.vueCompilerOptions.macros).flat(),
					]);
					for (const name of new Set([...locals, ...bindings])) {
						if (!listed.has(name) && !name.startsWith('__VLS_')) {
							items.push({
								label: name,
								kind: 6 satisfies typeof CompletionItemKind.Variable,
								textEdit: { range, newText: name },
							});
						}
					}
					// Like TypeScript's auto imports, exports are listed once a name is being typed.
					if (word) {
						const { fileName } = info.root;
						for (const entry of await getAutoImportValues(fileName) ?? []) {
							if (bindings.has(entry.name)) {
								continue;
							}
							items.push({
								label: entry.name,
								kind: entry.kind === 'class'
									? 7 satisfies typeof CompletionItemKind.Class
									: entry.kind === 'function'
									? 3 satisfies typeof CompletionItemKind.Function
									: 6 satisfies typeof CompletionItemKind.Variable,
								labelDetails: { description: entry.description },
								textEdit: { range, newText: entry.name },
								data: {
									__vue__autoImportValue: { uri: document.uri, fileName, entry },
								} satisfies AutoImportData,
							});
						}
					}
					return { isIncomplete: !word, items };
				},

				async resolveCompletionItem(item) {
					const data = (item.data as AutoImportData | undefined)?.__vue__autoImportValue;
					if (!data) {
						return item;
					}
					const info = resolveEmbeddedCode(context, data.uri);
					const edits = info && await getComponentImportEdits(data.fileName, data.entry);
					if (!info || !edits) {
						return item;
					}
					const sourceDocument = context.documents.get(info.script.id, info.script.languageId, info.script.snapshot);
					const embeddedDocument = context.documents.get(URI.parse(data.uri), info.code.languageId, info.code.snapshot);
					const map = context.language.maps.get(info.code, info.script);
					item = transformCompletionItem(
						item,
						embeddedRange => getSourceRange([sourceDocument, embeddedDocument, map], embeddedRange),
						embeddedDocument,
						context,
					);
					// The import edits are in the source document already.
					item.additionalTextEdits = edits.map(edit => ({
						range: {
							start: sourceDocument.positionAt(edit.pos),
							end: sourceDocument.positionAt(edit.end),
						},
						newText: edit.newText,
					}));
					resolvedItems.add(item);
					return item;
				},

				transformCompletionItem(item) {
					if (resolvedItems.has(item)) {
						return item;
					}
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

/** Also pushes to `locals` the names that the `v-for` and `v-slot` around the expression declare. */
function getExpressionStartAt(
	ts: typeof import('typescript'),
	node: CompilerDOM.RootNode | CompilerDOM.TemplateChildNode,
	offset: number,
	locals: string[],
): number | undefined {
	// The location of a `v-if` or `v-for` node does not cover all its branches or children.
	if (
		node.type !== 9 satisfies CompilerDOM.NodeTypes.IF
		&& node.type !== 11 satisfies CompilerDOM.NodeTypes.FOR
		&& (offset < node.loc.start.offset || offset > node.loc.end.offset)
	) {
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
				const start = getExpressionStartAt(ts, branch, offset, locals);
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
			const localCount = locals.length;
			if (node.type === 11 satisfies CompilerDOM.NodeTypes.FOR) {
				const { leftExpressionText } = parseVForNode(node);
				if (leftExpressionText) {
					locals.push(...getBindingNames(ts, `const [${leftExpressionText}]`));
				}
			}
			if (node.type === 1 satisfies CompilerDOM.NodeTypes.ELEMENT) {
				for (const prop of node.props) {
					if (
						prop.type === 7 satisfies CompilerDOM.NodeTypes.DIRECTIVE
						&& prop.name === 'slot'
						&& prop.exp?.type === 4 satisfies CompilerDOM.NodeTypes.SIMPLE_EXPRESSION
					) {
						locals.push(...getBindingNames(ts, `(${prop.exp.content}) => {}`));
					}
				}
			}
			for (const child of node.children) {
				const start = getExpressionStartAt(ts, child, offset, locals);
				if (start !== undefined) {
					return start;
				}
			}
			locals.length = localCount;
			return;
		}
	}
}

function getBindingNames(ts: typeof import('typescript'), text: string) {
	const coreTs = asCoreTypeScript(ts);
	const ast = coreTs.createSourceFile('/a.ts', text, coreTs.ScriptTarget.Latest);
	return collectBindingNames(coreTs, ast, ast);
}
