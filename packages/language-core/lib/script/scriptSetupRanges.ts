import { camelize } from '@vue/shared';
import type * as ts from 'typescript/ast' with { 'resolution-mode': 'import' };
import type { IRScriptSetup, TextRange, TypeScript, VueCompilerOptions } from '../types';
import { getNodeText, getStartEnd, isStringLiteralLike } from '../typescript/nodes';
import { collectBindingIdentifiers } from './bindingPatterns';
import { getClosestMultiLineCommentRange, parseBindings } from './scriptBindings';

const tsCheckRE = /^\/\/(?:\s*@ts-(?:no)?check(?:$|\s)|\/\s*<reference\s)/;

export interface CallExpressionRange {
	callExp: TextRange;
	exp: TextRange;
	arg?: TextRange;
	typeArg?: TextRange;
}

export interface DefineModel {
	arg?: TextRange;
	localName?: TextRange;
	name?: TextRange;
	type?: TextRange;
	modifierType?: TextRange;
	runtimeType?: TextRange;
	defaultValue?: TextRange;
	defaultPropsArg?: TextRange;
	required?: boolean;
	comments?: TextRange;
}

export interface DefineProps extends CallExpressionRange {
	name?: string;
	destructured?: Map<string, ts.Expression | undefined>;
	destructuredRest?: string;
	/** The default values of the destructure, by the text of the prop name as written (`a`, `'foo-bar'`). */
	destructuredDefaults?: { key: string; value: TextRange }[];
	statement: TextRange;
}

export interface DefineEmits extends CallExpressionRange {
	name?: string;
	hasUnionTypeArg?: boolean;
	statement: TextRange;
}

export interface DefineSlots extends CallExpressionRange {
	name?: string;
	statement: TextRange;
}

export interface DefineOptions {
	name?: string;
	inheritAttrs?: string;
}

export interface UseTemplateRef extends CallExpressionRange {
	name?: string;
}

export interface ScriptSetupRanges extends ReturnType<typeof parseScriptSetupRanges> {}

export function parseScriptSetupRanges(
	ts: TypeScript,
	sourceFile: ts.SourceFile,
	vueCompilerOptions: VueCompilerOptions,
) {
	const defineModel: DefineModel[] = [];
	let defineProps: DefineProps | undefined;
	let withDefaults: CallExpressionRange | undefined;
	let defineEmits: DefineEmits | undefined;
	let defineSlots: DefineSlots | undefined;
	let defineExpose: CallExpressionRange | undefined;
	let defineOptions: DefineOptions | undefined;
	const useAttrs: CallExpressionRange[] = [];
	const useCssModule: CallExpressionRange[] = [];
	const useSlots: CallExpressionRange[] = [];
	const useTemplateRef: UseTemplateRef[] = [];
	const text = sourceFile.text;

	const leadingCommentRanges = ts.getLeadingCommentRanges(text, 0)?.reverse() ?? [];
	const leadingCommentEndOffset = leadingCommentRanges.find(
		range => tsCheckRE.test(text.slice(range.pos, range.end)),
	)?.end ?? 0;

	let foundNonImportExportNode = false;
	let importSectionEndOffset = 0;

	sourceFile.forEachChild(node => {
		if (
			foundNonImportExportNode
			|| ts.isImportDeclaration(node)
			|| ts.isExportDeclaration(node)
			|| ts.isEmptyStatement(node)
			// fix https://github.com/vuejs/language-tools/issues/1223
			|| ts.isImportEqualsDeclaration(node)
		) {
			return;
		}

		if (
			(ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node))
			&& node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword)
		) {
			return;
		}

		const commentRanges = ts.getLeadingCommentRanges(text, node.pos);
		if (commentRanges?.length) {
			const commentRange = commentRanges.sort((a, b) => a.pos - b.pos)[0]!;
			importSectionEndOffset = commentRange.pos;
		}
		else {
			importSectionEndOffset = getStartEnd(node, sourceFile).start;
		}
		foundNonImportExportNode = true;
	});
	sourceFile.forEachChild(node => visitNode(node, [sourceFile]));

	return {
		bindings: parseBindings(ts, sourceFile),
		leadingCommentEndOffset,
		importSectionEndOffset,
		defineModel,
		defineProps,
		withDefaults,
		defineEmits,
		defineSlots,
		defineExpose,
		defineOptions,
		useAttrs,
		useCssModule,
		useSlots,
		useTemplateRef,
	};

	function visitNode(node: ts.Node, parents: ts.Node[]) {
		const parent = parents[parents.length - 1]!;
		if (
			ts.isCallExpression(node)
			&& ts.isIdentifier(node.expression)
		) {
			const callText = _getNodeText(node.expression);
			if (vueCompilerOptions.macros.defineModel.includes(callText)) {
				let localName: TextRange | undefined;
				let propName: ts.Expression | undefined;
				let options: ts.Expression | undefined;
				let type: TextRange | undefined;
				let modifierType: TextRange | undefined;
				let runtimeType: TextRange | undefined;
				let defaultValue: TextRange | undefined;
				let defaultPropsArg: TextRange | undefined;
				let required = false;

				if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
					localName = _getStartEnd(parent.name);
				}

				if (node.typeArguments) {
					if (node.typeArguments.length >= 1) {
						type = _getStartEnd(node.typeArguments[0]!);
					}
					if (node.typeArguments.length >= 2) {
						modifierType = _getStartEnd(node.typeArguments[1]!);
					}
				}

				if (node.arguments.length >= 2) {
					propName = node.arguments[0];
					options = node.arguments[1];
				}
				else if (node.arguments.length >= 1) {
					if (isStringLiteralLike(ts, node.arguments[0]!)) {
						propName = node.arguments[0];
					}
					else {
						options = node.arguments[0];
					}
				}

				if (options && ts.isObjectLiteralExpression(options)) {
					for (const property of options.properties) {
						let initializer: ts.Node;
						if (ts.isPropertyAssignment(property)) {
							initializer = property.initializer;
						}
						else if (ts.isMethodDeclaration(property) && _getNodeText(property.name) === 'default') {
							initializer = property;
						}
						else {
							continue;
						}
						if (!ts.isIdentifier(property.name)) {
							continue;
						}

						switch (_getNodeText(property.name)) {
							case 'type': {
								runtimeType = _getStartEnd(initializer);
								break;
							}
							case 'default': {
								if (ts.isPropertyAssignment(property)) {
									defaultValue = _getStartEnd(initializer);
								}
								if (ts.isFunctionLikeDeclaration(initializer) && initializer.parameters.length) {
									const firstArg = initializer.parameters[0]!;
									if (!firstArg.dotDotDotToken && !firstArg.type) {
										defaultPropsArg = _getStartEnd(firstArg);
									}
								}
								break;
							}
							case 'required': {
								if (initializer.kind === ts.SyntaxKind.TrueKeyword) {
									required = true;
								}
								break;
							}
						}
					}
				}

				let name: TextRange | undefined;
				if (propName && isStringLiteralLike(ts, propName)) {
					name = _getStartEnd(propName);
				}

				defineModel.push({
					localName,
					name,
					type,
					modifierType,
					runtimeType,
					defaultValue,
					defaultPropsArg,
					required,
					comments: getClosestMultiLineCommentRange(ts, node, parents, sourceFile),
					arg: _getStartEnd(node),
				});
			}
			else if (vueCompilerOptions.macros.defineProps.includes(callText)) {
				defineProps = {
					...parseCallExpressionAssignment(node, parent),
					statement: getStatementRange(ts, parents, node, sourceFile),
				};
				if (ts.isVariableDeclaration(parent) && ts.isObjectBindingPattern(parent.name)) {
					defineProps.destructured = new Map();
					const identifiers = collectBindingIdentifiers(ts, parent.name);
					for (const { id, isRest, initializer } of identifiers) {
						const name = _getNodeText(id);
						if (isRest) {
							defineProps.destructuredRest = name;
						}
						else {
							defineProps.destructured.set(name, initializer);
						}
					}
					defineProps.destructuredDefaults = [];
					for (const element of parent.name.elements) {
						const key: ts.Node | undefined = element.propertyName ?? element.name;
						if (key && !element.dotDotDotToken && element.initializer && !ts.isComputedPropertyName(key)) {
							defineProps.destructuredDefaults.push({
								key: _getNodeText(key),
								value: _getStartEnd(element.initializer),
							});
						}
					}
				}
				else if (
					ts.isCallExpression(parent)
					&& vueCompilerOptions.macros.withDefaults.includes(_getNodeText(parent.expression))
				) {
					const grand = parents.at(-2);
					if (grand && ts.isVariableDeclaration(grand)) {
						defineProps.name = _getNodeText(grand.name);
					}
				}
			}
			else if (vueCompilerOptions.macros.withDefaults.includes(callText)) {
				const [, arg] = node.arguments;
				withDefaults = {
					callExp: _getStartEnd(node),
					exp: _getStartEnd(node.expression),
					arg: arg ? _getStartEnd(arg) : undefined,
				};
			}
			else if (vueCompilerOptions.macros.defineEmits.includes(callText)) {
				defineEmits = {
					...parseCallExpressionAssignment(node, parent),
					statement: getStatementRange(ts, parents, node, sourceFile),
				};
				if (node.typeArguments?.length && ts.isTypeLiteralNode(node.typeArguments[0]!)) {
					for (const member of node.typeArguments[0].members) {
						if (ts.isCallSignatureDeclaration(member)) {
							const type = member.parameters[0]?.type;
							if (type && ts.isUnionTypeNode(type)) {
								defineEmits.hasUnionTypeArg = true;
								break;
							}
						}
					}
				}
			}
			else if (vueCompilerOptions.macros.defineSlots.includes(callText)) {
				defineSlots = {
					...parseCallExpressionAssignment(node, parent),
					statement: getStatementRange(ts, parents, node, sourceFile),
				};
			}
			else if (vueCompilerOptions.macros.defineExpose.includes(callText)) {
				defineExpose = parseCallExpression(node);
			}
			else if (
				vueCompilerOptions.macros.defineOptions.includes(callText)
				&& node.arguments.length
				&& ts.isObjectLiteralExpression(node.arguments[0]!)
			) {
				defineOptions = {};
				const obj = node.arguments[0];
				for (const prop of obj.properties) {
					if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
						const name = _getNodeText(prop.name);
						if (name === 'inheritAttrs') {
							defineOptions.inheritAttrs = _getNodeText(prop.initializer);
						}
						else if (name === 'name' && ts.isStringLiteral(prop.initializer)) {
							defineOptions.name = prop.initializer.text;
						}
					}
				}
			}
			else if (vueCompilerOptions.composables.useAttrs.includes(callText)) {
				useAttrs.push(parseCallExpression(node));
			}
			else if (vueCompilerOptions.composables.useCssModule.includes(callText)) {
				useCssModule.push(parseCallExpression(node));
			}
			else if (vueCompilerOptions.composables.useSlots.includes(callText)) {
				useSlots.push(parseCallExpression(node));
			}
			else if (
				vueCompilerOptions.composables.useTemplateRef.includes(callText)
				&& !node.typeArguments?.length
			) {
				useTemplateRef.push(parseCallExpressionAssignment(node, parent));
			}
		}

		node.forEachChild(child => {
			if (ts.isFunctionLikeDeclaration(node)) {
				return;
			}
			parents.push(node);
			visitNode(child, parents);
			parents.pop();
		});
	}

	function parseCallExpression(node: ts.CallExpression) {
		return {
			callExp: _getStartEnd(node),
			exp: _getStartEnd(node.expression),
			arg: node.arguments.length ? _getStartEnd(node.arguments[0]!) : undefined,
			typeArg: node.typeArguments?.length ? _getStartEnd(node.typeArguments[0]!) : undefined,
		};
	}

	function parseCallExpressionAssignment(node: ts.CallExpression, parent: ts.Node) {
		return {
			name: ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)
				? _getNodeText(parent.name)
				: undefined,
			...parseCallExpression(node),
		};
	}

	function _getStartEnd(node: ts.Node) {
		return getStartEnd(node, sourceFile);
	}

	function _getNodeText(node: ts.Node) {
		return getNodeText(node, sourceFile);
	}
}

function getStatementRange(
	ts: TypeScript,
	parents: ts.Node[],
	node: ts.Node,
	ast: ts.SourceFile,
) {
	let statementRange: TextRange | undefined;
	for (let i = parents.length - 1; i >= 0; i--) {
		const statement = parents[i]!;
		if (ts.isStatement(statement)) {
			statement.forEachChild(child => {
				const range = getStartEnd(child, ast);
				statementRange ??= range;
				statementRange.end = range.end;
			});
			break;
		}
	}
	if (!statementRange) {
		statementRange = getStartEnd(node, ast);
	}
	return statementRange;
}

/** The prop that `defineModel` declares in `scriptSetup`. */
export function getDefineModelPropName(scriptSetup: IRScriptSetup, defineModel: DefineModel) {
	return defineModel.name
		? camelize(scriptSetup.content.slice(defineModel.name.start + 1, defineModel.name.end - 1))
		: 'modelValue';
}
