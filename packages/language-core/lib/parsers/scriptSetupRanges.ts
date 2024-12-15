import type * as ts from 'typescript';
import { collectIdentifiers } from '../codegen/utils';
import type { TextRange, VueCompilerOptions } from '../types';

const tsCheckReg = /^\/\/\s*@ts-(?:no)?check($|\s)/;

export interface ScriptSetupRanges extends ReturnType<typeof parseScriptSetupRanges> { }

export function parseScriptSetupRanges(
	ts: typeof import('typescript'),
	ast: ts.SourceFile,
	vueCompilerOptions: VueCompilerOptions
) {
	const props: {
		name?: string;
		destructured?: Set<string>;
		destructuredRest?: string;
		define?: ReturnType<typeof parseDefineFunction> & {
			statement: TextRange;
		};
		withDefaults?: TextRange & {
			arg?: TextRange;
		};
	} = {};
	const slots: {
		name?: string;
		isObjectBindingPattern?: boolean;
		define?: ReturnType<typeof parseDefineFunction> & {
			statement: TextRange;
		};
	} = {};
	const emits: {
		name?: string;
		define?: ReturnType<typeof parseDefineFunction> & {
			statement: TextRange;
			hasUnionTypeArg?: boolean;
		};
	} = {};
	const expose: {
		name?: string;
		define?: ReturnType<typeof parseDefineFunction>;
	} = {};
	const options: {
		name?: string;
		inheritAttrs?: string;
	} = {};
	const attrs: {
		define: ReturnType<typeof parseDefineFunction>;
	}[] = []; 
	const cssModules: {
		define: ReturnType<typeof parseDefineFunction>;
	}[] = [];
	const templateRefs: {
		name?: string;
		define: ReturnType<typeof parseDefineFunction>;
	}[] = [];
	const definePropProposalA = vueCompilerOptions.experimentalDefinePropProposal === 'kevinEdition' || ast.text.trimStart().startsWith('// @experimentalDefinePropProposal=kevinEdition');
	const definePropProposalB = vueCompilerOptions.experimentalDefinePropProposal === 'johnsonEdition' || ast.text.trimStart().startsWith('// @experimentalDefinePropProposal=johnsonEdition');
	const defineProp: {
		localName: TextRange | undefined;
		name: TextRange | undefined;
		type: TextRange | undefined;
		modifierType?: TextRange | undefined;
		runtimeType: TextRange | undefined;
		defaultValue: TextRange | undefined;
		required: boolean;
		isModel?: boolean;
	}[] = [];
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
		const isTypeExport = (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) && node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword);
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
			&& node.importClause?.name
			&& !node.importClause.isTypeOnly
		) {
			const moduleName = _getNodeText(node.moduleSpecifier).slice(1, -1);
			if (vueCompilerOptions.extensions.some(ext => moduleName.endsWith(ext))) {
				importComponentNames.add(_getNodeText(node.importClause.name));
			}
		}
	});
	ts.forEachChild(ast, child => visitNode(child, [ast]));

	const templateRefNames = new Set(templateRefs.map(ref => ref.name));
	bindings = bindings.filter(range => {
		const name = text.slice(range.start, range.end);
		return !templateRefNames.has(name);
	});

	return {
		leadingCommentEndOffset,
		importSectionEndOffset,
		bindings,
		importComponentNames,
		props,
		slots,
		emits,
		expose,
		options,
		attrs,
		cssModules,
		defineProp,
		templateRefs,
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
			else if (vueCompilerOptions.macros.defineSlots.includes(callText)) {
				slots.define = {
					...parseDefineFunction(node),
					statement: getStatementRange(ts, parents, node, ast)
				};
				if (ts.isVariableDeclaration(parent)) {
					if (ts.isIdentifier(parent.name)) {
						slots.name = _getNodeText(parent.name);
					}
					else {
						slots.isObjectBindingPattern = ts.isObjectBindingPattern(parent.name);
					}
				}
			}
			else if (vueCompilerOptions.macros.defineEmits.includes(callText)) {
				emits.define = {
					...parseDefineFunction(node),
					statement: getStatementRange(ts, parents, node, ast)
				};
				if (ts.isVariableDeclaration(parent)) {
					emits.name = _getNodeText(parent.name);
				}
				if (node.typeArguments?.length && ts.isTypeLiteralNode(node.typeArguments[0])) {
					for (const member of node.typeArguments[0].members) {
						if (ts.isCallSignatureDeclaration(member)) {
							const type = member.parameters[0]?.type;
							if (type && ts.isUnionTypeNode(type)) {
								emits.define.hasUnionTypeArg = true;
								break;
							}
						}
					}
				}
			}
			else if (vueCompilerOptions.macros.defineExpose.includes(callText)) {
				expose.define = parseDefineFunction(node);
			}
			else if (vueCompilerOptions.macros.defineProps.includes(callText)) {
				if (ts.isVariableDeclaration(parent)) {
					if (ts.isObjectBindingPattern(parent.name)) {
						props.destructured = new Set();
						const identifiers = collectIdentifiers(ts, parent.name, []);
						for (const [id, isRest] of identifiers) {
							const name = _getNodeText(id);
							if (isRest) {
								props.destructuredRest = name;
							}
							else {
								props.destructured.add(name);
							}
						}
					}
					else {
						props.name = _getNodeText(parent.name);
					}
				}

				props.define = {
					...parseDefineFunction(node),
					statement: getStatementRange(ts, parents, node, ast),
				};

				if (node.arguments.length) {
					props.define.arg = _getStartEnd(node.arguments[0]);
				}
				if (node.typeArguments?.length) {
					props.define.typeArg = _getStartEnd(node.typeArguments[0]);
				}
			}
			else if (vueCompilerOptions.macros.withDefaults.includes(callText)) {
				props.withDefaults = _getStartEnd(node);
				if (node.arguments.length >= 2) {
					const arg = node.arguments[1];
					props.withDefaults.arg = _getStartEnd(arg);
				}
				if (ts.isVariableDeclaration(parent)) {
					props.name = _getNodeText(parent.name);
				}
			}
			else if (
				vueCompilerOptions.macros.defineOptions.includes(callText)
				&& node.arguments.length
				&& ts.isObjectLiteralExpression(node.arguments[0])
			) {
				const obj = node.arguments[0];
				ts.forEachChild(obj, node => {
					if (ts.isPropertyAssignment(node) && ts.isIdentifier(node.name)) {
						const name = _getNodeText(node.name);
						if (name === 'inheritAttrs') {
							options.inheritAttrs = _getNodeText(node.initializer);
						}
					}
				});
				for (const prop of obj.properties) {
					if (
						ts.isPropertyAssignment(prop)
						&& _getNodeText(prop.name) === 'name' && ts.isStringLiteral(prop.initializer)
					) {
						options.name = prop.initializer.text;
					}
				}
			}
			else if (vueCompilerOptions.composables.useAttrs.includes(callText)) {
				const define = parseDefineFunction(node);
				attrs.push({
					define
				});
			}
			else if (vueCompilerOptions.composables.useCssModule.includes(callText)) {
				const define = parseDefineFunction(node);
				cssModules.push({
					define
				});
			}
			else if (
				vueCompilerOptions.composables.useTemplateRef.includes(callText)
				&& !node.typeArguments?.length
			) {
				const define = parseDefineFunction(node);
				const name = ts.isVariableDeclaration(parent) ? _getNodeText(parent.name) : undefined;
				templateRefs.push({
					name,
					define
				});
			}
		}

		ts.forEachChild(node, child => {
			parents.push(node);
			visitNode(child, parents);
			parents.pop();
		});
	}

	function parseDefineFunction(node: ts.CallExpression) {
		return {
			..._getStartEnd(node),
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
