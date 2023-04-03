import type * as ts from 'typescript/lib/tsserverlibrary';
import type { VueCompilerOptions, TextRange } from '../types';

export interface ScriptSetupRanges extends ReturnType<typeof parseScriptSetupRanges> { }

export function parseScriptSetupRanges(
	ts: typeof import('typescript/lib/tsserverlibrary'),
	ast: ts.SourceFile,
	vueCompilerOptions: VueCompilerOptions,
) {

	let foundNonImportExportNode = false;
	let notOnTopTypeExports: TextRange[] = [];
	let importSectionEndOffset = 0;
	let withDefaultsArg: TextRange | undefined;
	let propsAssignName: string | undefined;
	let defineProps: TextRange | undefined;
	let propsRuntimeArg: TextRange | undefined;
	let propsTypeArg: TextRange | undefined;
	let slotsTypeArg: TextRange | undefined;
	let emitsAssignName: string | undefined;
	let emitsRuntimeArg: TextRange | undefined;
	let emitsTypeArg: TextRange | undefined;
	let exposeRuntimeArg: TextRange | undefined;
	let emitsTypeNums = -1;

	const defineProp: {
		name: TextRange;
		type: TextRange | undefined;
		defaultValue: TextRange | undefined;
		required: boolean;
	}[] = [];
	const bindings = parseBindingRanges(ts, ast, false);

	ast.forEachChild(node => {
		const isTypeExport = (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) && node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword);
		if (
			!foundNonImportExportNode
			&& !ts.isImportDeclaration(node)
			&& !isTypeExport
			&& !ts.isEmptyStatement(node)
			// fix https://github.com/johnsoncodehk/volar/issues/1223
			&& !ts.isImportEqualsDeclaration(node)
		) {
			importSectionEndOffset = node.getStart(ast, true);
			foundNonImportExportNode = true;
		}
		else if (isTypeExport && foundNonImportExportNode) {
			notOnTopTypeExports.push(_getStartEnd(node));
		}
	});
	ast.forEachChild(child => visitNode(child, ast));

	return {
		importSectionEndOffset,
		notOnTopTypeExports,
		bindings,
		withDefaultsArg,
		defineProps,
		propsAssignName,
		propsRuntimeArg,
		propsTypeArg,
		slotsTypeArg,
		emitsAssignName,
		emitsRuntimeArg,
		emitsTypeArg,
		emitsTypeNums,
		exposeRuntimeArg,
		defineProp,
	};

	function _getStartEnd(node: ts.Node) {
		return getStartEnd(node, ast);
	}
	function visitNode(node: ts.Node, parent: ts.Node) {
		if (
			ts.isCallExpression(node)
			&& ts.isIdentifier(node.expression)
		) {
			const callText = node.expression.getText(ast);
			if (callText === 'defineProp') {
				if (vueCompilerOptions.experimentalDefinePropProposal === 'johnsonEdition' && ts.isVariableDeclaration(parent)) {
					defineProp.push({
						name: _getStartEnd(parent.name),
						defaultValue: node.arguments.length >= 1 ? _getStartEnd(node.arguments[0]) : undefined,
						type: node.typeArguments?.length ? _getStartEnd(node.typeArguments[0]) : undefined,
						required: node.arguments.length >= 2 && node.arguments[1].kind === ts.SyntaxKind.TrueKeyword,
					});
				}
				else if (vueCompilerOptions.experimentalDefinePropProposal === 'johnsonEdition' && ts.isVariableDeclaration(parent)) {
					// TODO
				}
			}
			if (
				vueCompilerOptions.macros.defineProps.includes(callText)
				|| vueCompilerOptions.macros.defineSlots.includes(callText)
				|| vueCompilerOptions.macros.defineEmits.includes(callText)
				|| vueCompilerOptions.macros.defineExpose.includes(callText)
			) {
				if (vueCompilerOptions.macros.defineProps.includes(callText)) {
					defineProps = _getStartEnd(node);
				}
				if (node.arguments.length) {
					const runtimeArg = node.arguments[0];
					if (vueCompilerOptions.macros.defineProps.includes(callText)) {
						propsRuntimeArg = _getStartEnd(runtimeArg);
						if (ts.isVariableDeclaration(parent)) {
							propsAssignName = parent.name.getText(ast);
						}
					}
					else if (vueCompilerOptions.macros.defineEmits.includes(callText)) {
						emitsRuntimeArg = _getStartEnd(runtimeArg);
						if (ts.isVariableDeclaration(parent)) {
							emitsAssignName = parent.name.getText(ast);
						}
					}
					else if (vueCompilerOptions.macros.defineExpose.includes(callText)) {
						exposeRuntimeArg = _getStartEnd(runtimeArg);
					}
				}
				if (node.typeArguments?.length) {
					const typeArg = node.typeArguments[0];
					if (vueCompilerOptions.macros.defineProps.includes(callText)) {
						propsTypeArg = _getStartEnd(typeArg);
						if (ts.isVariableDeclaration(parent)) {
							propsAssignName = parent.name.getText(ast);
						}
					}
					if (vueCompilerOptions.macros.defineSlots.includes(callText)) {
						slotsTypeArg = _getStartEnd(typeArg);
					}
					else if (vueCompilerOptions.macros.defineEmits.includes(callText)) {
						emitsTypeArg = _getStartEnd(typeArg);
						if (ts.isTypeLiteralNode(typeArg)) {
							emitsTypeNums = typeArg.members.length;
						}
						if (ts.isVariableDeclaration(parent)) {
							emitsAssignName = parent.name.getText(ast);
						}
					}
				}
			}
			else if (vueCompilerOptions.macros.withDefaults.includes(callText)) {
				if (node.arguments.length >= 2) {
					const arg = node.arguments[1];
					withDefaultsArg = _getStartEnd(arg);
				}
				if (ts.isVariableDeclaration(parent)) {
					propsAssignName = parent.name.getText(ast);
				}
			}
		}
		node.forEachChild(child => visitNode(child, node));
	}
}

export function parseBindingRanges(ts: typeof import('typescript/lib/tsserverlibrary'), sourceFile: ts.SourceFile, isType: boolean) {
	const bindings: TextRange[] = [];
	sourceFile.forEachChild(node => {
		if (!isType) {
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
		}
		else {
			if (ts.isTypeAliasDeclaration(node)) {
				bindings.push(_getStartEnd(node.name));
			}
			else if (ts.isInterfaceDeclaration(node)) {
				bindings.push(_getStartEnd(node.name));
			}
		}

		if (ts.isImportDeclaration(node)) {
			if (node.importClause && (isType || !node.importClause.isTypeOnly)) {
				if (node.importClause.name && !isType) {
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
		return getStartEnd(node, sourceFile);
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
			vars.push(getStartEnd(_node, sourceFile));
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
			vars.push(getStartEnd(_node.name, sourceFile));
		}
		// { ...? } = ...
		// [ ...? ] = ...
		else if (ts.isSpreadAssignment(_node) || ts.isSpreadElement(_node)) {
			worker(_node.expression);
		}
	}
}

export function getStartEnd(node: ts.Node, sourceFile: ts.SourceFile) {
	return {
		start: node.getStart(sourceFile),
		end: node.getEnd(),
	};
}
