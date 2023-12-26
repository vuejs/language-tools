import type * as ts from 'typescript/lib/tsserverlibrary';
import type { VueCompilerOptions, TextRange } from '../types';

export interface ScriptSetupRanges extends ReturnType<typeof parseScriptSetupRanges> { }

export function parseScriptSetupRanges(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	ast: ts.SourceFile,
	vueCompilerOptions: VueCompilerOptions,
) {

	let foundNonImportExportNode = false;
	let importSectionEndOffset = 0;

	const props: {
		name?: string;
		define?: ReturnType<typeof parseDefineFunction> & {
			statement: TextRange;
		};
		withDefaults?: TextRange & {
			arg?: TextRange;
		};
	} = {};
	const slots: {
		name?: string;
		define?: ReturnType<typeof parseDefineFunction>;
	} = {};
	const emits: {
		name?: string;
		define?: ReturnType<typeof parseDefineFunction>;
	} = {};
	const expose: {
		name?: string;
		define?: ReturnType<typeof parseDefineFunction>;
	} = {};

	const definePropProposalA = vueCompilerOptions.experimentalDefinePropProposal === 'kevinEdition' || ast.text.trimStart().startsWith('// @experimentalDefinePropProposal=kevinEdition');
	const definePropProposalB = vueCompilerOptions.experimentalDefinePropProposal === 'johnsonEdition' || ast.text.trimStart().startsWith('// @experimentalDefinePropProposal=johnsonEdition');
	const defineProp: {
		name: TextRange | undefined;
		nameIsString: boolean;
		type: TextRange | undefined;
		defaultValue: TextRange | undefined;
		required: boolean;
	}[] = [];
	const bindings = parseBindingRanges(ts, ast);
	const text = ast.text;
	const leadingCommentEndOffset = ts.getLeadingCommentRanges(text, 0)?.reverse()[0].end ?? 0;

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
	});
	ts.forEachChild(ast, child => visitNode(child, [ast]));

	return {
		leadingCommentEndOffset,
		importSectionEndOffset,
		bindings,
		props,
		slots,
		emits,
		expose,
		defineProp,
	};

	function _getStartEnd(node: ts.Node) {
		return getStartEnd(ts, node, ast);
	}

	function parseDefineFunction(node: ts.CallExpression): TextRange & {
		arg?: TextRange;
		typeArg?: TextRange;
	} {
		return {
			..._getStartEnd(node),
			arg: node.arguments.length ? _getStartEnd(node.arguments[0]) : undefined,
			typeArg: node.typeArguments?.length ? _getStartEnd(node.typeArguments[0]) : undefined,
		};
	}

	function visitNode(node: ts.Node, parents: ts.Node[]) {
		const parent = parents[parents.length - 1];
		if (
			ts.isCallExpression(node)
			&& ts.isIdentifier(node.expression)
		) {
			const callText = getNodeText(ts, node.expression, ast);
			if (vueCompilerOptions.macros.defineModel.includes(callText)) {
				let name: TextRange | undefined;
				let options: ts.Node | undefined;
				if (node.arguments.length >= 2) {
					name = _getStartEnd(node.arguments[0]);
					options = node.arguments[1];
				}
				else if (node.arguments.length >= 1) {
					if (ts.isStringLiteral(node.arguments[0])) {
						name = _getStartEnd(node.arguments[0]);
					}
					else {
						options = node.arguments[0];
					}
				}
				let required = false;
				if (options && ts.isObjectLiteralExpression(options)) {
					for (const property of options.properties) {
						if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name) && getNodeText(ts, property.name, ast) === 'required' && property.initializer.kind === ts.SyntaxKind.TrueKeyword) {
							required = true;
							break;
						}
					}
				}
				defineProp.push({
					name,
					nameIsString: true,
					type: node.typeArguments?.length ? _getStartEnd(node.typeArguments[0]) : undefined,
					defaultValue: undefined,
					required,
				});
			}
			else if (callText === 'defineProp') {
				if (definePropProposalA) {
					let required = false;
					if (node.arguments.length >= 2) {
						const secondArg = node.arguments[1];
						if (ts.isObjectLiteralExpression(secondArg)) {
							for (const property of secondArg.properties) {
								if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name) && getNodeText(ts, property.name, ast) === 'required' && property.initializer.kind === ts.SyntaxKind.TrueKeyword) {
									required = true;
									break;
								}
							}
						}
					}
					if (node.arguments.length >= 1) {
						defineProp.push({
							name: _getStartEnd(node.arguments[0]),
							nameIsString: true,
							type: node.typeArguments?.length ? _getStartEnd(node.typeArguments[0]) : undefined,
							defaultValue: undefined,
							required,
						});
					}
					else if (ts.isVariableDeclaration(parent)) {
						defineProp.push({
							name: _getStartEnd(parent.name),
							nameIsString: false,
							type: node.typeArguments?.length ? _getStartEnd(node.typeArguments[0]) : undefined,
							defaultValue: undefined,
							required,
						});
					}
				}
				else if (definePropProposalB && ts.isVariableDeclaration(parent)) {
					defineProp.push({
						name: _getStartEnd(parent.name),
						nameIsString: false,
						defaultValue: node.arguments.length >= 1 ? _getStartEnd(node.arguments[0]) : undefined,
						type: node.typeArguments?.length ? _getStartEnd(node.typeArguments[0]) : undefined,
						required: node.arguments.length >= 2 && node.arguments[1].kind === ts.SyntaxKind.TrueKeyword,
					});
				}
			}
			else if (vueCompilerOptions.macros.defineSlots.includes(callText)) {
				slots.define = parseDefineFunction(node);
				if (ts.isVariableDeclaration(parent)) {
					slots.name = getNodeText(ts, parent.name, ast);
				}
			}
			else if (vueCompilerOptions.macros.defineEmits.includes(callText)) {
				emits.define = parseDefineFunction(node);
				if (ts.isVariableDeclaration(parent)) {
					emits.name = getNodeText(ts, parent.name, ast);
				}
			}
			else if (vueCompilerOptions.macros.defineExpose.includes(callText)) {
				expose.define = parseDefineFunction(node);
			}
			else if (vueCompilerOptions.macros.defineProps.includes(callText)) {

				let statementRange: TextRange | undefined;
				for (let i = parents.length - 1; i >= 0; i--) {
					if (ts.isStatement(parents[i])) {
						const statement = parents[i];
						ts.forEachChild(statement, child => {
							const range = _getStartEnd(child);
							statementRange ??= range;
							statementRange.end = range.end;
						});
						break;
					}
				}
				if (!statementRange) {
					statementRange = _getStartEnd(node);
				}

				props.define = {
					...parseDefineFunction(node),
					statement: statementRange,
				};

				if (ts.isVariableDeclaration(parent)) {
					props.name = getNodeText(ts, parent.name, ast);
				}
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
					props.name = getNodeText(ts, parent.name, ast);
				}
			}
		}
		ts.forEachChild(node, child => {
			parents.push(node);
			visitNode(child, parents);
			parents.pop();
		});
	}
}

export function parseBindingRanges(ts: typeof import('typescript/lib/tsserverlibrary'), sourceFile: ts.SourceFile) {
	const bindings: TextRange[] = [];
	ts.forEachChild(sourceFile, node => {
		if (ts.isVariableStatement(node)) {
			for (const node_2 of node.declarationList.declarations) {
				const vars = _findBindingVars(node_2.name);
				for (const _var of vars) {
					bindings.push(_var);
				}
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

export function findBindingVars(ts: typeof import('typescript/lib/tsserverlibrary'), left: ts.BindingName, sourceFile: ts.SourceFile) {
	const vars: TextRange[] = [];
	worker(left);
	return vars;
	function worker(_node: ts.Node) {
		if (ts.isIdentifier(_node)) {
			vars.push(getStartEnd(ts, _node, sourceFile));
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
			vars.push(getStartEnd(ts, _node.name, sourceFile));
		}
		// { ...? } = ...
		// [ ...? ] = ...
		else if (ts.isSpreadAssignment(_node) || ts.isSpreadElement(_node)) {
			worker(_node.expression);
		}
	}
}

export function getStartEnd(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	node: ts.Node,
	sourceFile: ts.SourceFile
) {
	return {
		start: (ts as any).getTokenPosOfNode(node, sourceFile) as number,
		end: node.end,
	};
}

export function getNodeText(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	node: ts.Node,
	sourceFile: ts.SourceFile
) {
	const { start, end } = getStartEnd(ts, node, sourceFile);
	return sourceFile.text.substring(start, end);
}
