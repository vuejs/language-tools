import type * as ts from 'typescript';
import type { TextRange, VueCompilerOptions } from '../types';
import { collectBindingIdentifiers } from '../utils/collectBindings';
import { getNodeText, getStartEnd } from '../utils/shared';
import { getClosestMultiLineCommentRange, parseBindingRanges } from './utils';

const tsCheckReg = /^\/\/\s*@ts-(?:no)?check(?:$|\s)/;

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
	required?: boolean;
	comments?: TextRange;
}

export interface DefineProps extends CallExpressionRange {
	name?: string;
	destructured?: Map<string, ts.Expression | undefined>;
	destructuredRest?: string;
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
	ts: typeof import('typescript'),
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
		range => tsCheckReg.test(text.slice(range.pos, range.end)),
	)?.end ?? 0;

	let { bindings, components } = parseBindingRanges(ts, sourceFile, vueCompilerOptions.extensions);
	let foundNonImportExportNode = false;
	let importSectionEndOffset = 0;

	ts.forEachChild(sourceFile, node => {
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
			importSectionEndOffset = getStartEnd(ts, node, sourceFile).start;
		}
		foundNonImportExportNode = true;
	});
	ts.forEachChild(sourceFile, node => visitNode(node, [sourceFile]));

	const templateRefNames = new Set(useTemplateRef.map(ref => ref.name));
	bindings = bindings.filter(range => {
		const name = text.slice(range.start, range.end);
		return !templateRefNames.has(name);
	});

	return {
		leadingCommentEndOffset,
		importSectionEndOffset,
		bindings,
		components,
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
					if (ts.isStringLiteralLike(node.arguments[0]!)) {
						propName = node.arguments[0];
					}
					else {
						options = node.arguments[0];
					}
				}

				if (options && ts.isObjectLiteralExpression(options)) {
					for (const property of options.properties) {
						if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)) {
							continue;
						}
						const text = _getNodeText(property.name);
						if (text === 'type') {
							runtimeType = _getStartEnd(property.initializer);
						}
						else if (text === 'default') {
							defaultValue = _getStartEnd(property.initializer);
						}
						else if (text === 'required' && property.initializer.kind === ts.SyntaxKind.TrueKeyword) {
							required = true;
						}
					}
				}

				let name: TextRange | undefined;
				if (propName && ts.isStringLiteralLike(propName)) {
					name = _getStartEnd(propName);
				}

				defineModel.push({
					localName,
					name,
					type,
					modifierType,
					runtimeType,
					defaultValue,
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

		ts.forEachChild(node, child => {
			if (ts.isFunctionLike(node)) {
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
		return getStartEnd(ts, node, sourceFile);
	}

	function _getNodeText(node: ts.Node) {
		return getNodeText(ts, node, sourceFile);
	}
}

function getStatementRange(
	ts: typeof import('typescript'),
	parents: ts.Node[],
	node: ts.Node,
	ast: ts.SourceFile,
) {
	let statementRange: TextRange | undefined;
	for (let i = parents.length - 1; i >= 0; i--) {
		const statement = parents[i]!;
		if (ts.isStatement(statement)) {
			ts.forEachChild(statement, child => {
				const range = getStartEnd(ts, child, ast);
				statementRange ??= range;
				statementRange.end = range.end;
			});
			break;
		}
	}
	if (!statementRange) {
		statementRange = getStartEnd(ts, node, ast);
	}
	return statementRange;
}
