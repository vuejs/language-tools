import type { ts, TypeScript } from '@vue/language-core';
import type { Access } from './rules';
import { type Accesses, createSignalNode, type Signal, type SignalNode } from './signals';

/** The identifiers of one source file grouped by what they refer to, as the checker of its project resolves them. */
export interface SameFileSymbols {
	/** The names of the declarations, in the file, of what the identifier at `position` refers to. */
	getDeclarations(position: number): readonly ts.Identifier[];
	/** The identifiers that refer to what the identifier at `position` refers to, its declarations among them, in source order. */
	getReferences(position: number): readonly ts.Identifier[];
}

export interface Range {
	pos: number;
	end: number;
}

export interface ReactivityAnalysisResult {
	dependencyRanges: Range[];
	dependentRanges: Range[];
}

export interface AnalysisContext {
	ts: TypeScript;
	sourceFile: ts.SourceFile;
	signals: readonly Signal[];
	accesses: Accesses;
	symbols: SameFileSymbols;
}

/**
 * The signals that the signal at `position` (its binding, or the callback around it) depends on, and the
 * callbacks that depend on it, or `undefined` if it has neither a dependency nor a dependent.
 */
export function analyze(context: AnalysisContext, position: number): ReactivityAnalysisResult | undefined {
	const { ts, sourceFile, signals, accesses, symbols } = context;
	const signal = findSignalByBindingRange(position) ?? findSignalByCallbackRange(position);
	if (!signal) {
		return;
	}
	const dependencies = findDependencies(signal);
	const dependents = findDependents(signal);
	if ((!signal.isDependency && !dependencies.length) || (!signal.isDependent && !dependents.length)) {
		return;
	}
	return {
		dependencyRanges: dependencies.map(getRange),
		dependentRanges: dependents.flatMap(({ callback }) => callback ? [getRange(callback)] : []),
	};

	/** A block by its statements, which leaves out its braces. */
	function getRange({ pos, end, ast }: SignalNode): Range {
		if (ts.isBlock(ast) && ast.statements.length) {
			const { statements } = ast;
			return { pos: statements[0]!.getStart(sourceFile), end: statements.at(-1)!.end };
		}
		return { pos, end };
	}

	function findDependencies(signal: Signal, visited = new Set<Signal>()) {
		if (visited.has(signal)) {
			return [];
		}
		visited.add(signal);
		const nodes: SignalNode[] = [];
		let hasDependency = !!signal.isDependency;
		if (signal.accessor) {
			visit(signal.accessor, signal.accessor.requireAccess);
		}
		return hasDependency ? nodes : [];

		function visit(node: SignalNode, requireAccess: boolean, parentIsPropertyAccess = false) {
			const { ast } = node;
			if (!requireAccess) {
				if (!parentIsPropertyAccess && ts.isIdentifier(ast)) {
					for (const declaration of getSignalDeclarations(node.pos)) {
						if (declaration.binding) {
							nodes.push(declaration.binding);
							hasDependency ||= !!declaration.isDependency;
						}
						addDependenciesOf(declaration);
					}
				}
			}
			else if (
				ts.isPropertyAccessExpression(ast) || ts.isElementAccessExpression(ast) || ts.isCallExpression(ast)
			) {
				for (const declaration of getSignalDeclarations(node.pos)) {
					const { binding } = declaration;
					if (binding?.accesses.some(access => isAccessedBy(ast, access))) {
						nodes.push(binding);
						hasDependency ||= !!declaration.isDependency;
						addDependenciesOf(declaration);
					}
				}
			}
			const isFunction = ts.isFunctionExpression(ast) || ts.isArrowFunction(ast);
			const isPropertyAccess = ts.isPropertyAccessExpression(ast) || ts.isElementAccessExpression(ast);
			ast.forEachChild(child => {
				visit(createSignalNode(child, sourceFile), isFunction || requireAccess, isPropertyAccess);
			});
		}

		function addDependenciesOf(declaration: Signal) {
			if (declaration.callback) {
				nodes.push(declaration.callback);
			}
			const dependencies = findDependencies(declaration, visited);
			nodes.push(...dependencies);
			hasDependency ||= dependencies.length > 0;
		}
	}

	function findDependents(signal: Signal, visited = new Set<Signal>()) {
		const { binding } = signal;
		if (!binding || visited.has(signal)) {
			return [];
		}
		visited.add(signal);
		const result: Signal[] = [];
		for (const reference of symbols.getReferences(binding.pos)) {
			const effect = findSignalByAccessorRange(reference.getStart(sourceFile));
			if (!effect?.accessor) {
				continue;
			}
			if (
				!effect.accessor.requireAccess
				|| binding.accesses.some(access => isAccessAt(reference.end, access))
			) {
				const dependents = findDependents(effect, visited);
				result.push(...dependents);
				if (effect.isDependent || dependents.length) {
					result.push(effect);
				}
			}
		}
		return result;
	}

	/** The signals declared by what the identifier at `position` refers to. */
	function getSignalDeclarations(position: number) {
		return symbols.getDeclarations(position).flatMap(declaration => {
			const signal = findSignalByBindingRange(declaration.getStart(sourceFile));
			return signal ? [signal] : [];
		});
	}

	function isAccessedBy(
		node: ts.PropertyAccessExpression | ts.ElementAccessExpression | ts.CallExpression,
		access: Access,
	) {
		if (ts.isPropertyAccessExpression(node)) {
			return access.kind === 'anyProperty'
				? node.name.text !== ''
				: access.kind === 'property' && access.name === node.name.text;
		}
		if (ts.isElementAccessExpression(node)) {
			return access.kind === 'anyProperty';
		}
		return access.kind === 'call';
	}

	/** Whether the expression that ends at `end` is read by `access`. */
	function isAccessAt(end: number, access: Access) {
		switch (access.kind) {
			case 'anyProperty':
				return accesses.properties.has(end);
			case 'property':
				return accesses.properties.get(end) === access.name;
			case 'call':
				return accesses.calls.has(end);
		}
	}

	function findSignalByBindingRange(position: number) {
		return signals.find(({ binding }) => binding && binding.pos <= position && binding.end >= position);
	}

	function findSignalByCallbackRange(position: number) {
		return findInnermost(signal => signal.callback, position);
	}

	function findSignalByAccessorRange(position: number) {
		return findInnermost(signal => signal.accessor, position);
	}

	function findInnermost(getNode: (signal: Signal) => Range | undefined, position: number) {
		let innermost: [Signal, Range] | undefined;
		for (const signal of signals) {
			const node = getNode(signal);
			if (
				node && node.pos <= position && node.end >= position
				&& (!innermost || node.end - node.pos < innermost[1].end - innermost[1].pos)
			) {
				innermost = [signal, node];
			}
		}
		return innermost?.[0];
	}
}
