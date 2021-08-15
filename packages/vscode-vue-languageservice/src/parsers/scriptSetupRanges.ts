import type * as ts from 'typescript/lib/tsserverlibrary';
import type { TextRange } from './types';

export type ScriptSetupRanges = ReturnType<typeof parseScriptSetupRanges>;

export function parseScriptSetupRanges(ts: typeof import('typescript/lib/tsserverlibrary'), ast: ts.SourceFile) {

	let withDefaultsArg: TextRange | undefined;
	let propsRuntimeArg: TextRange | undefined;
	let propsTypeArg: TextRange | undefined;
	let emitsRuntimeArg: TextRange | undefined;
	let emitsTypeArg: TextRange | undefined;

	const bindings = parseBindingRanges(ts, ast);

	ast.forEachChild(node => {
		visitNode(node);
	});

	return {
		bindings,
		withDefaultsArg,
		propsRuntimeArg,
		propsTypeArg,
		emitsRuntimeArg,
		emitsTypeArg,
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
			if (callText === 'defineProps' || callText === 'defineEmits') {
				if (node.arguments.length) {
					const runtimeArg = node.arguments[0];
					if (callText === 'defineProps') {
						propsRuntimeArg = _getStartEnd(runtimeArg);
					}
					else {
						emitsRuntimeArg = _getStartEnd(runtimeArg);
					}
				}
				else if (node.typeArguments?.length) {
					const typeArg = node.typeArguments[0];
					if (callText === 'defineProps') {
						propsTypeArg = _getStartEnd(typeArg);
					}
					else {
						emitsTypeArg = _getStartEnd(typeArg);
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

export function parseBindingRanges(ts: typeof import('typescript/lib/tsserverlibrary'), sourceFile: ts.SourceFile) {
	const bindings: TextRange[] = [];
	sourceFile.forEachChild(node => {
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
		else if (ts.isImportDeclaration(node)) {
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
		else if (ts.isClassDeclaration(node)) {
			if (node.name) {
				bindings.push(_getStartEnd(node.name));
			}
		}
		else if (ts.isEnumDeclaration(node)) {
			bindings.push(_getStartEnd(node.name));
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
