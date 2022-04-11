import type * as ts from 'typescript/lib/tsserverlibrary';
import type { TextRange } from '../types';

export interface ScriptSetupRanges extends ReturnType<typeof parseScriptSetupRanges> { }

export function parseScriptSetupRanges(ts: typeof import('typescript/lib/tsserverlibrary'), ast: ts.SourceFile) {

	let foundNonImportExportNode = false;
	let notOnTopTypeExports: TextRange[] = [];
	let importSectionEndOffset = 0;
	let withDefaultsArg: TextRange | undefined;
	let propsRuntimeArg: TextRange | undefined;
	let propsTypeArg: TextRange | undefined;
	let emitsRuntimeArg: TextRange | undefined;
	let emitsTypeArg: TextRange | undefined;
	let exposeRuntimeArg: TextRange | undefined;
	let exposeTypeArg: TextRange | undefined;
	let emitsTypeNums = -1;

	const bindings = parseBindingRanges(ts, ast, false);
	const typeBindings = parseBindingRanges(ts, ast, true);

	ast.forEachChild(node => {
		const isTypeExport = (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) && node.modifiers?.some(mod => mod.kind === ts.SyntaxKind.ExportKeyword);
		if (
			!foundNonImportExportNode
			&& !ts.isImportDeclaration(node)
			&& !isTypeExport
			&& !ts.isEmptyStatement(node)
		) {
			importSectionEndOffset = node.getStart(ast);
			foundNonImportExportNode = true;
		}
		else if (isTypeExport && foundNonImportExportNode) {
			notOnTopTypeExports.push(_getStartEnd(node));
		}
	});
	ast.forEachChild(visitNode);

	return {
		importSectionEndOffset,
		notOnTopTypeExports,
		bindings,
		typeBindings,
		withDefaultsArg,
		propsRuntimeArg,
		propsTypeArg,
		emitsRuntimeArg,
		emitsTypeArg,
		emitsTypeNums,
		exposeRuntimeArg,
		exposeTypeArg,
	};

	function _getStartEnd(node: ts.Node) {
		return getStartEnd(node, ast);
	}
	function visitNode(node: ts.Node) {
		if (
			ts.isCallExpression(node)
			&& ts.isIdentifier(node.expression)
		) {
			const callText = node.expression.getText(ast);
			if (callText === 'defineProps' || callText === 'defineEmits' || callText === 'defineExpose') {
				if (node.arguments.length) {
					const runtimeArg = node.arguments[0];
					if (callText === 'defineProps') {
						propsRuntimeArg = _getStartEnd(runtimeArg);
					}
					else if (callText === 'defineEmits') {
						emitsRuntimeArg = _getStartEnd(runtimeArg);
					}
					else if (callText === 'defineExpose') {
						exposeRuntimeArg = _getStartEnd(runtimeArg);
					}
				}
				if (node.typeArguments?.length) {
					const typeArg = node.typeArguments[0];
					if (callText === 'defineProps') {
						propsTypeArg = _getStartEnd(typeArg);
					}
					else if (callText === 'defineEmits') {
						emitsTypeArg = _getStartEnd(typeArg);
						if (ts.isTypeLiteralNode(typeArg)) {
							emitsTypeNums = typeArg.members.length;
						}
					}
					else if (callText === 'defineExpose') {
						exposeTypeArg = _getStartEnd(typeArg);
					}
				}
			}
			else if (callText === 'withDefaults') {
				if (node.arguments.length >= 2) {
					const arg = node.arguments[1];
					withDefaultsArg = _getStartEnd(arg);
				}
			}
		}
		node.forEachChild(child => visitNode(child));
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
	// TODO: high cost
	const start = node.getStart(sourceFile);
	const end = node.getEnd();
	return {
		start: start,
		end: end,
	};
}
