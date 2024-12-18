import type * as ts from 'typescript';
import { collectIdentifiers } from '../codegen/utils';
import type { TextRange, VueCompilerOptions } from '../types';

const tsCheckReg = /^\/\/\s*@ts-(?:no)?check($|\s)/;

type CallExpressionRange = {
	callExp: TextRange;
	exp: TextRange;
	arg?: TextRange;
	typeArg?: TextRange;
};

type DefineProp = {
	localName?: TextRange;
	name?: TextRange;
	type?: TextRange;
	modifierType?: TextRange;
	runtimeType?: TextRange;
	defaultValue?: TextRange;
	required?: boolean;
	isModel?: boolean;
}

type DefineProps = CallExpressionRange & {
	name?: string;
	destructured?: Set<string>;
	destructuredRest?: string;
	statement: TextRange;
}

type WithDefaults = Pick<CallExpressionRange, 'callExp' | 'exp' | 'arg'>;

type DefineEmits = CallExpressionRange & {
	name?: string;
	hasUnionTypeArg?: boolean;
	statement: TextRange;
}

type DefineSlots = CallExpressionRange & {
	name?: string;
	isObjectBindingPattern?: boolean;
	statement: TextRange;
}

type DefineExpose = CallExpressionRange;

type DefineOptions = {
	name?: string;
	inheritAttrs?: string;
}

type UseAttrs = CallExpressionRange;

type UseCssModule = CallExpressionRange;

type UseSlots = CallExpressionRange;

type UseTemplateRef = CallExpressionRange & {
	name?: string;
}

export interface ScriptSetupRanges extends ReturnType<typeof parseScriptSetupRanges> { }

export function parseScriptSetupRanges(
	ts: typeof import('typescript'),
	ast: ts.SourceFile,
	vueCompilerOptions: VueCompilerOptions
) {
	const defineProp: DefineProp[] = [];
	let defineProps: DefineProps | undefined;
	let withDefaults: WithDefaults | undefined;
	let defineEmits: DefineEmits | undefined;
	let defineSlots: DefineSlots | undefined;
	let defineExpose: DefineExpose | undefined;
	let defineOptions: DefineOptions | undefined;
	const useAttrs: UseAttrs[] = [];
	const useCssModule: UseCssModule[] = [];
	const useSlots: UseSlots[] = [];
	const useTemplateRef: UseTemplateRef[] = [];
	const definePropProposalA = vueCompilerOptions.experimentalDefinePropProposal === 'kevinEdition' || ast.text.trimStart().startsWith('// @experimentalDefinePropProposal=kevinEdition');
	const definePropProposalB = vueCompilerOptions.experimentalDefinePropProposal === 'johnsonEdition' || ast.text.trimStart().startsWith('// @experimentalDefinePropProposal=johnsonEdition');
	const text = ast.text;
	const importComponentNames = new Set<string>();

	const leadingCommentRanges = ts.getLeadingCommentRanges(text, 0)?.reverse() ?? [];
	const leadingCommentEndOffset = leadingCommentRanges.find(
		range => tsCheckReg.test(text.slice(range.pos, range.end))
	)?.end ?? 0;

	let bindings = parseBindingRanges(ts, ast);
	let foundNonImportExportNode = false;
	let importSectionEndOffset = 0;

	ts.forEachChild(ast, node => {
		const isTypeExport =
			(ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node))
			&& node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword);
		if (
			!foundNonImportExportNode
			&& !ts.isImportDeclaration(node)
			&& !isTypeExport
			&& !ts.isEmptyStatement(node)
			// fix https://github.com/vuejs/language-tools/issues/1223
			&& !ts.isImportEqualsDeclaration(node)
		) {
			const commentRanges = ts.getLeadingCommentRanges(text, node.pos);
			if (commentRanges?.length) {
				const commentRange = commentRanges.sort((a, b) => a.pos - b.pos)[0];
				importSectionEndOffset = commentRange.pos;
			}
			else {
				importSectionEndOffset = getStartEnd(ts, node, ast).start;
			}
			foundNonImportExportNode = true;
		}

		if (
			ts.isImportDeclaration(node)
			&& node.importClause
			&& !node.importClause.isTypeOnly
		) {
			const moduleName = _getNodeText(node.moduleSpecifier).slice(1, -1);
			if (vueCompilerOptions.extensions.some(ext => moduleName.endsWith(ext))) {
				const { name, namedBindings } = node.importClause;
				if (name) {
					importComponentNames.add(_getNodeText(name));
				}
				if (namedBindings && ts.isNamedImports(namedBindings)) {
					for (const element of namedBindings.elements) {
						if (
							!element.isTypeOnly
							&& element.propertyName?.text === 'default'
						) {
							importComponentNames.add(_getNodeText(element.name));
						}
					}
				}
			}
		}
	});
	ts.forEachChild(ast, child => visitNode(child, [ast]));

	const templateRefNames = new Set(useTemplateRef.map(ref => ref.name));
	bindings = bindings.filter(range => {
		const name = text.slice(range.start, range.end);
		return !templateRefNames.has(name);
	});

	return {
		leadingCommentEndOffset,
		importSectionEndOffset,
		bindings,
		importComponentNames,
		defineProp,
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
		const parent = parents[parents.length - 1];
		if (
			ts.isCallExpression(node)
			&& ts.isIdentifier(node.expression)
		) {
			const callText = _getNodeText(node.expression);
			if (vueCompilerOptions.macros.defineModel.includes(callText)) {
				let localName: TextRange | undefined;
				let propName: TextRange | undefined;
				let options: ts.Node | undefined;

				if (
					ts.isVariableDeclaration(parent) &&
					ts.isIdentifier(parent.name)
				) {
					localName = _getStartEnd(parent.name);
				}

				if (node.arguments.length >= 2) {
					propName = _getStartEnd(node.arguments[0]);
					options = node.arguments[1];
				}
				else if (node.arguments.length >= 1) {
					if (ts.isStringLiteralLike(node.arguments[0])) {
						propName = _getStartEnd(node.arguments[0]);
					}
					else {
						options = node.arguments[0];
					}
				}

				let runtimeType: TextRange | undefined;
				let defaultValue: TextRange | undefined;
				let required = false;
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
				defineProp.push({
					localName,
					name: propName,
					type: node.typeArguments?.length ? _getStartEnd(node.typeArguments[0]) : undefined,
					modifierType: node.typeArguments && node.typeArguments?.length >= 2 ? _getStartEnd(node.typeArguments[1]) : undefined,
					runtimeType,
					defaultValue,
					required,
					isModel: true,
				});
			}
			else if (callText === 'defineProp') {
				let localName: TextRange | undefined;
				let propName: TextRange | undefined;
				let options: ts.Node | undefined;

				if (
					ts.isVariableDeclaration(parent) &&
					ts.isIdentifier(parent.name)
				) {
					localName = _getStartEnd(parent.name);
				}

				let runtimeType: TextRange | undefined;
				let defaultValue: TextRange | undefined;
				let required = false;
				if (definePropProposalA) {
					if (node.arguments.length >= 2) {
						options = node.arguments[1];
					}
					if (node.arguments.length >= 1) {
						propName = _getStartEnd(node.arguments[0]);
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
				}
				else if (definePropProposalB) {
					if (node.arguments.length >= 3) {
						options = node.arguments[2];
					}
					if (node.arguments.length >= 2) {
						if (node.arguments[1].kind === ts.SyntaxKind.TrueKeyword) {
							required = true;
						}
					}
					if (node.arguments.length >= 1) {
						defaultValue = _getStartEnd(node.arguments[0]);
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
						}
					}
				}

				defineProp.push({
					localName,
					name: propName,
					type: node.typeArguments?.length ? _getStartEnd(node.typeArguments[0]) : undefined,
					runtimeType,
					defaultValue,
					required,
				});
			}
			else if (vueCompilerOptions.macros.defineProps.includes(callText)) {
				defineProps = {
					...parseCallExpression(node),
					statement: getStatementRange(ts, parents, node, ast)
				};
				if (ts.isVariableDeclaration(parent)) {
					if (ts.isObjectBindingPattern(parent.name)) {
						defineProps.destructured = new Set();
						const identifiers = collectIdentifiers(ts, parent.name, []);
						for (const [id, isRest] of identifiers) {
							const name = _getNodeText(id);
							if (isRest) {
								defineProps.destructuredRest = name;
							}
							else {
								defineProps.destructured.add(name);
							}
						}
					}
					else {
						defineProps.name = _getNodeText(parent.name);
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
					arg: arg ? _getStartEnd(arg) : undefined
				};
			}
			else if (vueCompilerOptions.macros.defineEmits.includes(callText)) {
				defineEmits = {
					...parseCallExpression(node),
					statement: getStatementRange(ts, parents, node, ast)
				};
				if (ts.isVariableDeclaration(parent)) {
					defineEmits.name = _getNodeText(parent.name);
				}
				if (node.typeArguments?.length && ts.isTypeLiteralNode(node.typeArguments[0])) {
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
					...parseCallExpression(node),
					statement: getStatementRange(ts, parents, node, ast)
				};
				if (ts.isVariableDeclaration(parent)) {
					if (ts.isIdentifier(parent.name)) {
						defineSlots.name = _getNodeText(parent.name);
					}
					else {
						defineSlots.isObjectBindingPattern = ts.isObjectBindingPattern(parent.name);
					}
				}
			}
			else if (vueCompilerOptions.macros.defineExpose.includes(callText)) {
				defineExpose = parseCallExpression(node);
			}
			else if (
				vueCompilerOptions.macros.defineOptions.includes(callText)
				&& node.arguments.length
				&& ts.isObjectLiteralExpression(node.arguments[0])
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
				useTemplateRef.push({
					name: ts.isVariableDeclaration(parent) ? _getNodeText(parent.name) : undefined,
					...parseCallExpression(node)
				});
			}
		}

		ts.forEachChild(node, child => {
			parents.push(node);
			visitNode(child, parents);
			parents.pop();
		});
	}

	function parseCallExpression(node: ts.CallExpression) {
		return {
			callExp: _getStartEnd(node),
			exp: _getStartEnd(node.expression),
			arg: node.arguments.length ? _getStartEnd(node.arguments[0]) : undefined,
			typeArg: node.typeArguments?.length ? _getStartEnd(node.typeArguments[0]) : undefined,
		};
	}

	function _getStartEnd(node: ts.Node) {
		return getStartEnd(ts, node, ast);
	}

	function _getNodeText(node: ts.Node) {
		return getNodeText(ts, node, ast);
	}
}

export function parseBindingRanges(ts: typeof import('typescript'), sourceFile: ts.SourceFile) {
	const bindings: TextRange[] = [];
	ts.forEachChild(sourceFile, node => {
		if (ts.isVariableStatement(node)) {
			for (const decl of node.declarationList.declarations) {
				const vars = _findBindingVars(decl.name);
				bindings.push(...vars);
			}
		}
		else if (ts.isFunctionDeclaration(node)) {
			if (node.name && ts.isIdentifier(node.name)) {
				bindings.push(_getStartEnd(node.name));
			}
		}
		else if (ts.isClassDeclaration(node)) {
			if (node.name) {
				bindings.push(_getStartEnd(node.name));
			}
		}
		else if (ts.isEnumDeclaration(node)) {
			bindings.push(_getStartEnd(node.name));
		}

		if (ts.isImportDeclaration(node)) {
			if (node.importClause && !node.importClause.isTypeOnly) {
				if (node.importClause.name) {
					bindings.push(_getStartEnd(node.importClause.name));
				}
				if (node.importClause.namedBindings) {
					if (ts.isNamedImports(node.importClause.namedBindings)) {
						for (const element of node.importClause.namedBindings.elements) {
							if (element.isTypeOnly) {
								continue;
							}
							bindings.push(_getStartEnd(element.name));
						}
					}
					else if (ts.isNamespaceImport(node.importClause.namedBindings)) {
						bindings.push(_getStartEnd(node.importClause.namedBindings.name));
					}
				}
			}
		}
	});
	return bindings;

	function _getStartEnd(node: ts.Node) {
		return getStartEnd(ts, node, sourceFile);
	}

	function _findBindingVars(left: ts.BindingName) {
		return findBindingVars(ts, left, sourceFile);
	}
}

export function findBindingVars(
	ts: typeof import('typescript'),
	left: ts.BindingName,
	sourceFile: ts.SourceFile
) {
	const vars: TextRange[] = [];
	worker(left);
	return vars;
	function worker(node: ts.Node) {
		if (ts.isIdentifier(node)) {
			vars.push(getStartEnd(ts, node, sourceFile));
		}
		// { ? } = ...
		// [ ? ] = ...
		else if (ts.isObjectBindingPattern(node) || ts.isArrayBindingPattern(node)) {
			for (const property of node.elements) {
				if (ts.isBindingElement(property)) {
					worker(property.name);
				}
			}
		}
		// { foo: ? } = ...
		else if (ts.isPropertyAssignment(node)) {
			worker(node.initializer);
		}
		// { foo } = ...
		else if (ts.isShorthandPropertyAssignment(node)) {
			vars.push(getStartEnd(ts, node.name, sourceFile));
		}
		// { ...? } = ...
		// [ ...? ] = ...
		else if (ts.isSpreadAssignment(node) || ts.isSpreadElement(node)) {
			worker(node.expression);
		}
	}
}

export function getStartEnd(
	ts: typeof import('typescript'),
	node: ts.Node,
	sourceFile: ts.SourceFile
): TextRange {
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
	return sourceFile.text.slice(start, end);
}

function getStatementRange(
	ts: typeof import('typescript'),
	parents: ts.Node[],
	node: ts.Node,
	sourceFile: ts.SourceFile
) {
	let statementRange: TextRange | undefined;
	for (let i = parents.length - 1; i >= 0; i--) {
		if (ts.isStatement(parents[i])) {
			const statement = parents[i];
			ts.forEachChild(statement, child => {
				const range = getStartEnd(ts, child, sourceFile);
				statementRange ??= range;
				statementRange.end = range.end;
			});
			break;
		}
	}
	if (!statementRange) {
		statementRange = getStartEnd(ts, node, sourceFile);
	}
	return statementRange;
}
