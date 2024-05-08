import type * as ts from 'typescript';
import type { TextRange, VueCompilerOptions } from '../types';
import { injectTscApiShim } from './tscApiShim';

export enum BindingTypes {
	NoUnref = 2 << 0,
	NeedUnref = 2 << 1,
	DirectAccess = 2 << 2,
	Component = 2 << 3,
}

export function parseBindings(
	ts: typeof import('typescript'),
	sourceFile: ts.SourceFile,
	vueCompilerOptions?: VueCompilerOptions,
) {
	ts = injectTscApiShim(ts);
	const bindingRanges: TextRange[] = [];
	// `bindingTypes` may include some bindings that are not in `bindingRanges`, such as `foo` in `defineProps({ foo: Number })`
	const bindingTypes = new Map<string, BindingTypes>();
	const vueImportAliases: Record<string, string> = {
		ref: 'ref',
		computed: 'computed',
		shallowRef: 'shallowRef',
		customRef: 'customRef',
		toRef: 'toRef',
	};

	ts.forEachChild(sourceFile, node => {
		// TODO: User may use package name alias then the import specifier may not be `vue`
		if (ts.isImportDeclaration(node) && _getNodeText(node.moduleSpecifier) === vueCompilerOptions?.lib) {
			const namedBindings = node.importClause?.namedBindings;
			if (namedBindings && ts.isNamedImports(namedBindings)) {
				for (const element of namedBindings.elements) {
					vueImportAliases[_getNodeText(element.name)] = element.propertyName ? _getNodeText(element.propertyName) : _getNodeText(element.name);
				}
			}
		}
	});

	ts.forEachChild(sourceFile, node => {
		if (ts.isVariableStatement(node)) {
			for (const decl of node.declarationList.declarations) {
				const declList = node.declarationList;

				worker(decl.name, true);
				function worker(_node: ts.Node, root = false) {
					if (ts.isIdentifier(_node)) {
						const name = _getNodeText(_node);
						bindingRanges.push(_getStartEnd(_node));
						if (root) {
							if (declList.flags & ts.NodeFlags.Const) {
								if (decl.initializer) {
									if (ts.isCallExpression(decl.initializer)) {
										const callee = _getNodeText(decl.initializer.expression);
										if (
											callee === vueImportAliases.ref
											|| callee === vueImportAliases.computed
											|| callee === vueImportAliases.shallowRef
											|| callee === vueImportAliases.customRef
											|| callee === vueImportAliases.toRef
										) {
											bindingTypes.set(name, BindingTypes.NeedUnref);
										}
										else if (vueCompilerOptions?.macros.defineProps.includes(callee)) {
											bindingTypes.set(name, BindingTypes.DirectAccess);
											if (decl.initializer.typeArguments?.length === 1) {
												const typeNode = decl.initializer.typeArguments[0];
												if (ts.isTypeLiteralNode(typeNode)) {
													for (const prop of typeNode.members) {
														if (ts.isPropertySignature(prop)) {
															bindingTypes.set(_getNodeText(prop.name), BindingTypes.NoUnref);
														}
													}
												}
											}
											else if (decl.initializer.arguments.length === 1) {
												const arg = decl.initializer.arguments[0];
												if (ts.isObjectLiteralExpression(arg)) {
													for (const prop of arg.properties) {
														if (ts.isPropertyAssignment(prop)) {
															bindingTypes.set(_getNodeText(prop.name), BindingTypes.NoUnref);
														}
													}
												}
												else if (ts.isArrayLiteralExpression(arg)) {
													for (const prop of arg.elements) {
														if (ts.isStringLiteral(prop)) {
															bindingTypes.set(_getNodeText(prop), BindingTypes.NoUnref);
														}
													}
												}
											}
										}
									}
									else {
										bindingTypes.set(
											name,
											canNeverBeRef(decl.initializer, vueImportAliases.reactive) ? BindingTypes.NoUnref : BindingTypes.NeedUnref
										);
									}
								}
								else {
									bindingTypes.set(name, BindingTypes.NeedUnref);
								}
							}
							// let a = 1;
							else {
								bindingTypes.set(name, BindingTypes.NeedUnref);
							}
						}
					}
					// { ? } = ...
					// [ ? ] = ...
					else if (ts.isObjectBindingPattern(_node) || ts.isArrayBindingPattern(_node)) {
						for (const property of _node.elements) {
							if (ts.isBindingElement(property)) {
								worker(property.name);
							}
						}
					}
					// { foo: ? } = ...
					else if (ts.isPropertyAssignment(_node)) {
						worker(_node.initializer);
					}
					// { foo } = ...
					else if (ts.isShorthandPropertyAssignment(_node)) {
						addBinding(_node.name, BindingTypes.NeedUnref);
					}
					// { ...? } = ...
					// [ ...? ] = ...
					else if (ts.isSpreadAssignment(_node) || ts.isSpreadElement(_node)) {
						worker(_node.expression);
					}
				}
			}
		}
		else if (
			ts.isFunctionDeclaration(node)
			|| ts.isClassDeclaration(node)
			|| ts.isEnumDeclaration(node)
		) {
			if (node.name) {
				addBinding(node.name, BindingTypes.NoUnref);
			}
		}
		else if (ts.isImportDeclaration(node)) {
			if (node.importClause && !node.importClause.isTypeOnly) {
				if (node.importClause.name) {
					const name = _getNodeText(node.importClause.name);
					bindingRanges.push(_getStartEnd(node.importClause.name));
					if (
						ts.isStringLiteral(node.moduleSpecifier)
						&& !node.importClause.isTypeOnly
						&& vueCompilerOptions?.extensions.some(ext => _getNodeText(node.moduleSpecifier).slice(1, -1).endsWith(ext))
					) {
						bindingTypes.set(name, BindingTypes.NoUnref | BindingTypes.Component);
					}
					else {
						bindingTypes.set(name, BindingTypes.NeedUnref);
					}
				}
				if (node.importClause.namedBindings) {
					if (ts.isNamedImports(node.importClause.namedBindings)) {
						for (const element of node.importClause.namedBindings.elements) {
							addBinding(element.name, BindingTypes.NeedUnref);
						}
					}
					else if (ts.isNamespaceImport(node.importClause.namedBindings)) {
						addBinding(node.importClause.namedBindings.name, BindingTypes.NoUnref);
					}
				}
			}
		}
	});
	return { bindingRanges, bindingTypes };

	function _getStartEnd(node: ts.Node) {
		return getStartEnd(ts, node, sourceFile);
	}
	function _getNodeText(node: ts.Node) {
		return getNodeText(ts, node, sourceFile);
	}
	function addBinding(node: ts.Node, bindingType: BindingTypes) {
		bindingRanges.push(_getStartEnd(node));
		bindingTypes.set(_getNodeText(node), bindingType);
	}
	function getValueNode(node: ts.Node) {
		if (
			ts.isAsExpression(node)
			|| ts.isSatisfiesExpression(node)
			|| ts.isTypeAssertionExpression(node)
			|| ts.isParenthesizedExpression(node)
			|| ts.isNonNullExpression(node)
			|| ts.isExpressionWithTypeArguments(node)
		) {
			return getValueNode(node.expression);
		}
		else if (ts.isCommaListExpression(node)) {
			return getValueNode(node.elements[node.elements.length - 1]);
		}
		return node;
	}
	function canNeverBeRef(node: ts.Node, userReactiveImport?: string): boolean {
		node = getValueNode(node);
		if (isCallOf(node, userReactiveImport)) {
			return true;
		}
		else if (
			ts.isPrefixUnaryExpression(node)
			|| ts.isPostfixUnaryExpression(node)
			|| ts.isArrayLiteralExpression(node)
			|| ts.isObjectLiteralExpression(node)
			|| ts.isFunctionExpression(node)
			|| ts.isArrowFunction(node)
			|| ts.isClassExpression(node)
			|| ts.isTaggedTemplateExpression(node)
			|| ts.isNoSubstitutionTemplateLiteral(node)
			|| ts.isLiteralExpression(node)
			|| node.kind === ts.SyntaxKind.TrueKeyword
			|| node.kind === ts.SyntaxKind.FalseKeyword
			|| node.kind === ts.SyntaxKind.NullKeyword
		) {
			return true;
		}
		else if (ts.isBinaryExpression(node)) {
			return canNeverBeRef(node.left, userReactiveImport) && canNeverBeRef(node.right, userReactiveImport);
		}
		else if (ts.isConditionalExpression(node)) {
			return canNeverBeRef(node.whenTrue, userReactiveImport) && canNeverBeRef(node.whenFalse, userReactiveImport);
		}
		return false;
	}
	function isCallOf(node: ts.Node, userReactiveImport?: string): boolean {
		if (ts.isCallExpression(node)) {
			if (ts.isIdentifier(node.expression) && _getNodeText(node.expression) === userReactiveImport) {
				return true;
			}
		}
		return false;
	}
}

export function getStartEnd(
	ts: typeof import('typescript'),
	node: ts.Node,
	sourceFile: ts.SourceFile
) {
	return {
		start: (ts as any).getTokenPosOfNode(node, sourceFile) as number,
		end: node.end,
	};
}

export function getNodeText(
	ts: typeof import('typescript'),
	node: ts.Node,
	sourceFile: ts.SourceFile
) {
	const { start, end } = getStartEnd(ts, node, sourceFile);
	return sourceFile.text.substring(start, end);
}
