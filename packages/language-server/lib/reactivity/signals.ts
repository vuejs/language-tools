import { isFunctionLike, isStringLiteralLike, type ts, type TypeScript } from '@vue/language-core';
import { type Access, callAccess, type Rule } from './rules';

export interface SignalNode {
	pos: number;
	end: number;
	ast: ts.Node;
}

/**
 * A reactive declaration or a call that tracks signals: `binding` is read by `accesses`, `accessor` reads the
 * signals it depends on, and `callback` runs when they change.
 */
export interface Signal {
	binding?: SignalNode & { accesses: readonly Access[] };
	/** `requireAccess`: only reads by an access of a binding count, as in a function body; otherwise any mention does. */
	accessor?: SignalNode & { requireAccess: boolean };
	callback?: SignalNode;
	isDependency?: boolean;
	isDependent?: boolean;
}

/** How each expression that is read is accessed, by the end of the expression. */
export interface Accesses {
	/** The property name of `x.name` or `x['name']`, or `undefined` for `x[key]`. */
	properties: Map<number, string | undefined>;
	/** The ends of called identifiers. */
	calls: Set<number>;
}

export function createSignalNode(node: ts.Node, sourceFile: ts.SourceFile): SignalNode {
	return { pos: node.getStart(sourceFile), end: node.end, ast: node };
}

/** The signals of the reactivity calls that `rules` match, and of the functions, that `sourceFile` declares. */
export function collectSignals(ts: TypeScript, sourceFile: ts.SourceFile, rules: readonly Rule[]) {
	const signals: Signal[] = [];
	const resolved = new Set<ts.Node>();
	visit(sourceFile);
	return signals;

	function visit(node: ts.Node) {
		if (ts.isVariableDeclaration(node)) {
			const { name, initializer } = node;
			if (initializer) {
				if (ts.isCallExpression(initializer) && ts.isIdentifier(initializer.expression)) {
					if (resolveCall(initializer, initializer.expression, name)) {
						resolved.add(initializer);
					}
				}
				else if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) {
					signals.push(createFunctionSignal(name, initializer.body));
				}
			}
		}
		else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && !resolved.has(node)) {
			resolveCall(node, node.expression, undefined);
		}
		else if (ts.isFunctionDeclaration(node) && node.name && node.body) {
			signals.push(createFunctionSignal(node.name, node.body));
		}
		node.forEachChild(visit);
	}

	/** Whether a rule matches `callee`; if one does, adds the signals that it resolves. */
	function resolveCall(call: ts.CallExpression, callee: ts.Identifier, binding: ts.BindingName | undefined) {
		const rule = rules.find(rule => rule.name.test(callee.text));
		if (!rule) {
			return false;
		}
		const declared: [ts.Node, readonly Access[]][] = [];
		const signal: Signal = {};
		rule.resolve({
			ts,
			call,
			binding,
			signal(node, accesses) {
				declared.push([node, accesses]);
			},
			accessor(node) {
				signal.accessor = getTrackedNode(node);
			},
			callback(node) {
				signal.isDependent = true;
				signal.callback = createSignalNode(getTrackedNode(node).ast, sourceFile);
			},
			effect(node) {
				const tracked = getTrackedNode(node);
				if (tracked.requireAccess) {
					signal.accessor = tracked;
				}
				signal.isDependent = true;
				signal.callback = createSignalNode(tracked.ast, sourceFile);
			},
		});
		if (declared.length) {
			for (const [node, accesses] of declared) {
				signals.push({
					...signal,
					isDependency: true,
					binding: { ...createSignalNode(node, sourceFile), accesses },
				});
			}
		}
		else {
			signals.push(signal);
		}
		return true;
	}

	/** A function is tracked by its body, which reads signals by accessing them; any other expression by itself. */
	function getTrackedNode(node: ts.Node): SignalNode & { requireAccess: boolean } {
		if (isFunctionLike(ts, node) && 'body' in node && node.body) {
			return { ...createSignalNode(node.body, sourceFile), requireAccess: true };
		}
		return { ...createSignalNode(node, sourceFile), requireAccess: false };
	}

	function createFunctionSignal(name: ts.Node, body: ts.Node): Signal {
		const bodyNode = createSignalNode(body, sourceFile);
		return {
			binding: { ...createSignalNode(name, sourceFile), accesses: [callAccess] },
			accessor: { ...bodyNode, requireAccess: true },
			callback: bodyNode,
		};
	}
}

export function collectAccesses(ts: TypeScript, sourceFile: ts.SourceFile): Accesses {
	const properties = new Map<number, string | undefined>();
	const calls = new Set<number>();
	visit(sourceFile);
	return { properties, calls };

	function visit(node: ts.Node) {
		if (ts.isPropertyAccessExpression(node)) {
			properties.set(node.expression.end, node.name.text);
		}
		else if (ts.isElementAccessExpression(node)) {
			const { argumentExpression } = node;
			properties.set(
				node.expression.end,
				isStringLiteralLike(ts, argumentExpression) ? argumentExpression.text : undefined,
			);
		}
		else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
			calls.add(node.expression.end);
		}
		node.forEachChild(visit);
	}
}
