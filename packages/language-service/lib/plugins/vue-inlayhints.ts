import type { InlayHint, InlayHintKind, LanguageServicePlugin } from '@volar/language-service';
import { collectBindingIdentifiers, tsCodegen } from '@vue/language-core';
import type * as ts from 'typescript';
import { resolveEmbeddedCode } from '../utils';

export function create(ts: typeof import('typescript')): LanguageServicePlugin {
	return {
		name: 'vue-inlayhints',
		capabilities: {
			inlayHintProvider: {},
		},
		create(context) {
			return {
				async provideInlayHints(document, range) {
					const info = resolveEmbeddedCode(context, document.uri);
					if (info?.code.id !== 'main') {
						return;
					}

					const settings: Record<string, boolean> = {};
					async function getSettingEnabled(key: string) {
						return settings[key] ??= await context.env.getConfiguration<boolean>?.(key) ?? false;
					}

					const result: InlayHint[] = [];
					const { sfc } = info.root;

					const codegen = tsCodegen.get(sfc);
					const inlayHints = [
						...codegen?.getGeneratedTemplate()?.inlayHints ?? [],
						...codegen?.getGeneratedScript().inlayHints ?? [],
					];
					const scriptSetupRanges = codegen?.getScriptSetupRanges();

					if (scriptSetupRanges?.defineProps?.destructured && sfc.scriptSetup?.ast) {
						const setting = 'vue.inlayHints.destructuredProps';
						const enabled = await getSettingEnabled(setting);

						if (enabled) {
							for (
								const [prop, isShorthand] of findDestructuredProps(
									ts,
									sfc.scriptSetup.ast,
									scriptSetupRanges.defineProps.destructured.keys(),
								)
							) {
								const name = prop.text;
								const end = prop.getEnd();
								const pos = isShorthand ? end : end - name.length;
								const label = isShorthand ? `: props.${name}` : 'props.';
								inlayHints.push({
									blockName: 'scriptSetup',
									offset: pos,
									setting,
									label,
								});
							}
						}
					}

					const blocks = [
						sfc.template,
						sfc.script,
						sfc.scriptSetup,
					];
					const start = document.offsetAt(range.start);
					const end = document.offsetAt(range.end);

					for (const hint of inlayHints) {
						const block = blocks.find(block => block?.name === hint.blockName);
						if (!block) {
							continue;
						}

						const hintOffset = block.startTagEnd + hint.offset;
						if (hintOffset < start || hintOffset >= end) {
							continue;
						}

						const enabled = await getSettingEnabled(hint.setting);
						if (!enabled) {
							continue;
						}

						result.push({
							label: hint.label,
							paddingRight: hint.paddingRight,
							paddingLeft: hint.paddingLeft,
							position: document.positionAt(hintOffset),
							kind: 2 satisfies typeof InlayHintKind.Parameter,
							tooltip: hint.tooltip
								? {
									kind: 'markdown',
									value: hint.tooltip,
								}
								: undefined,
						});
					}

					return result;
				},
			};
		},
	};
}

/**
 * true -> prop binding
 * false -> local binding
 */
type Scope = Record<string, boolean>;

/**
 * Refactored from https://github.com/vuejs/core/blob/main/packages/compiler-sfc/src/script/definePropsDestructure.ts
 */
export function findDestructuredProps(
	ts: typeof import('typescript'),
	ast: ts.SourceFile,
	props: MapIterator<string>,
) {
	const rootScope: Scope = Object.create(null);
	const scopeStack: Scope[] = [rootScope];
	let currentScope: Scope | null = rootScope;
	const excludedIds = new WeakSet<ts.Identifier>();

	for (const prop of props) {
		rootScope[prop] = true;
	}

	function pushScope() {
		scopeStack.push(currentScope = Object.create(currentScope));
	}

	function popScope() {
		scopeStack.pop();
		currentScope = scopeStack[scopeStack.length - 1] || null;
	}

	function registerLocalBinding(id: ts.Identifier) {
		excludedIds.add(id);
		if (currentScope) {
			currentScope[id.text] = false;
		}
	}

	const references: [ts.Identifier, boolean][] = [];

	walkScope(ast, true);
	walk(ast);

	return references;

	function walkScope(node: ts.Node, isRoot = false) {
		ts.forEachChild(node, stmt => {
			if (ts.isVariableStatement(stmt)) {
				for (const decl of stmt.declarationList.declarations) {
					walkVariableDeclaration(decl, isRoot);
				}
			}
			else if (
				ts.isFunctionDeclaration(stmt)
				|| ts.isClassDeclaration(stmt)
			) {
				const declare = ts.getModifiers(stmt)?.find(modifier => modifier.kind === ts.SyntaxKind.DeclareKeyword);
				if (!stmt.name || declare) {
					return;
				}
				registerLocalBinding(stmt.name);
			}
			else if (
				(ts.isForOfStatement(stmt) || ts.isForInStatement(stmt))
				&& ts.isVariableDeclarationList(stmt.initializer)
			) {
				walkVariableDeclaration(stmt.initializer.declarations[0]!, isRoot);
			}
			else if (
				ts.isLabeledStatement(stmt)
				&& ts.isVariableDeclaration(stmt.statement)
			) {
				walkVariableDeclaration(stmt.statement, isRoot);
			}
		});
	}

	function walkVariableDeclaration(decl: ts.VariableDeclaration, isRoot = false) {
		const { initializer, name } = decl;
		const isDefineProps = isRoot
			&& initializer
			&& ts.isCallExpression(initializer)
			&& initializer.expression.getText(ast) === 'defineProps';

		for (const { id } of collectBindingIdentifiers(ts, name)) {
			if (isDefineProps) {
				excludedIds.add(id);
			}
			else {
				registerLocalBinding(id);
			}
		}
	}

	function walkFunctionDeclaration(node: ts.SignatureDeclaration) {
		const { name, parameters } = node;
		if (name && ts.isIdentifier(name)) {
			registerLocalBinding(name);
		}

		for (const p of parameters) {
			for (const { id } of collectBindingIdentifiers(ts, p)) {
				registerLocalBinding(id);
			}
		}
	}

	function walk(parent: ts.Node) {
		ts.forEachChild(parent, node => {
			if (enter(node) ?? true) {
				walk(node);
				leave(node);
			}
		});

		function enter(node: ts.Node) {
			if (
				ts.isTypeLiteralNode(node)
				|| ts.isTypeReferenceNode(node)
			) {
				return false;
			}

			if (ts.isFunctionLike(node)) {
				pushScope();
				walkFunctionDeclaration(node);
				if ('body' in node) {
					walkScope(node.body!);
				}
				return;
			}

			if (ts.isCatchClause(node)) {
				pushScope();
				const { variableDeclaration: p } = node;
				if (p && ts.isIdentifier(p.name)) {
					registerLocalBinding(p.name);
				}
				walkScope(node.block);
				return;
			}

			if (
				ts.isBlock(node)
				&& !ts.isFunctionLike(parent)
				&& !ts.isCatchClause(parent)
			) {
				pushScope();
				walkScope(node);
				return;
			}

			if (
				ts.isIdentifier(node)
				&& isReferencedIdentifier(node, parent)
				&& !excludedIds.has(node)
			) {
				const name = node.text;
				if (currentScope![name]) {
					const isShorthand = ts.isShorthandPropertyAssignment(parent);
					references.push([node, isShorthand]);
				}
			}
		}

		function leave(node: ts.Node) {
			if (
				ts.isFunctionLike(node)
				|| ts.isCatchClause(node)
				|| (
					ts.isBlock(node)
					&& !ts.isFunctionLike(parent)
					&& !ts.isCatchClause(parent)
				)
			) {
				popScope();
			}
		}
	}

	// TODO: more conditions
	function isReferencedIdentifier(
		id: ts.Identifier,
		parent: ts.Node | null,
	) {
		if (!parent) {
			return false;
		}

		if (id.text === 'arguments') {
			return false;
		}

		if (
			ts.isExpressionWithTypeArguments(parent)
			|| ts.isInterfaceDeclaration(parent)
			|| ts.isTypeAliasDeclaration(parent)
			|| ts.isPropertySignature(parent)
		) {
			return false;
		}

		if (
			ts.isPropertyAccessExpression(parent)
			|| ts.isPropertyAssignment(parent)
			|| ts.isPropertyDeclaration(parent)
		) {
			if (parent.name === id) {
				return false;
			}
		}

		return true;
	}
}
