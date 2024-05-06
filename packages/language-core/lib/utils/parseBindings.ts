import type * as ts from 'typescript';
import type { TextRange } from '../types';

export enum BindingTypes {
	NoUnref,
	NeedUnref,
	DirectAccess,
}

export function parseBindings(ts: typeof import('typescript'), sourceFile: ts.SourceFile) {
	const bindingRanges: TextRange[] = [];
	// `bindingTypes` may include some bindings that are not in `bindingRanges`, such as `foo` in `defineProps({ foo: Number })`
	const bindingTypes = new Map<string, BindingTypes>();

	ts.forEachChild(sourceFile, node => {
		if (ts.isVariableStatement(node)) {
			for (const decl of node.declarationList.declarations) {
				worker(decl.name, true);

				function worker(_node: ts.Node, root = false) {
					if (ts.isIdentifier(_node)) {
						const nodeText = _getNodeText(_node);
						bindingRanges.push(_getStartEnd(_node));

						if (root) {
							if (decl.initializer && ts.isCallExpression(decl.initializer)) {
								const callText = _getNodeText(decl.initializer.expression);
								if (callText === 'ref') {
									bindingTypes.set(nodeText, BindingTypes.NeedUnref);
								}
								// TODO: use vue compiler options
								else if (callText === 'defineProps') {
									bindingTypes.set(nodeText, BindingTypes.DirectAccess);
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
													bindingTypes.set(prop.text, BindingTypes.NoUnref);
												}
											}
										}
									}
								}
							}
							else {
								bindingTypes.set(nodeText, BindingTypes.NeedUnref);
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
						const nodeText = _getNodeText(_node.name);
						bindingRanges.push(_getStartEnd(_node.name));
						bindingTypes.set(nodeText, BindingTypes.NeedUnref);
					}
					// { ...? } = ...
					// [ ...? ] = ...
					else if (ts.isSpreadAssignment(_node) || ts.isSpreadElement(_node)) {
						worker(_node.expression);
					}
				}
			}
		}
		else if (ts.isFunctionDeclaration(node)) {
			if (node.name && ts.isIdentifier(node.name)) {
				const nodeText = _getNodeText(node.name);
				bindingRanges.push(_getStartEnd(node.name));
				bindingTypes.set(nodeText, BindingTypes.NoUnref);
			}
		}
		else if (ts.isClassDeclaration(node)) {
			if (node.name) {
				const nodeText = _getNodeText(node.name);
				bindingRanges.push(_getStartEnd(node.name));
				bindingTypes.set(nodeText, BindingTypes.NoUnref);
			}
		}
		else if (ts.isEnumDeclaration(node)) {
			const nodeText = _getNodeText(node.name);
			bindingRanges.push(_getStartEnd(node.name));
			bindingTypes.set(nodeText, BindingTypes.NoUnref);
		}

		if (ts.isImportDeclaration(node)) {
			if (node.importClause && !node.importClause.isTypeOnly) {
				if (node.importClause.name) {
					const nodeText = _getNodeText(node.importClause.name);
					bindingRanges.push(_getStartEnd(node.importClause.name));
					if (ts.isStringLiteral(node.moduleSpecifier) && _getNodeText(node.moduleSpecifier).endsWith('.vue')) {
						bindingTypes.set(nodeText, BindingTypes.NoUnref);
					}
					else {
						bindingTypes.set(nodeText, BindingTypes.NeedUnref);
					}
				}
				if (node.importClause.namedBindings) {
					if (ts.isNamedImports(node.importClause.namedBindings)) {
						for (const element of node.importClause.namedBindings.elements) {
							const nodeText = _getNodeText(element.name);
							bindingRanges.push(_getStartEnd(element.name));
							bindingTypes.set(nodeText, BindingTypes.NeedUnref);
						}
					}
					else if (ts.isNamespaceImport(node.importClause.namedBindings)) {
						const nodeText = _getNodeText(node.importClause.namedBindings.name);
						bindingRanges.push(_getStartEnd(node.importClause.namedBindings.name));
						bindingTypes.set(nodeText, BindingTypes.NoUnref);
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
