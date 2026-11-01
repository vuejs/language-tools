import type { ts, TypeScript } from '@vue/language-core';

/** How a signal's binding is read to track it: by one property, by any property, or by calling it. */
export type Access =
	| { kind: 'property'; name: string }
	| { kind: 'anyProperty' }
	| { kind: 'call' };

export const valueAccess: Access = { kind: 'property', name: 'value' };
export const anyPropertyAccess: Access = { kind: 'anyProperty' };
export const callAccess: Access = { kind: 'call' };

export interface RuleContext {
	ts: TypeScript;
	call: ts.CallExpression;
	/** The name that the call's result is declared to. */
	binding: ts.BindingName | undefined;
	/** `node` declares a signal, read by `accesses`. */
	signal(node: ts.Node, accesses: readonly Access[]): void;
	/** `node` reads the signals that the call tracks. */
	accessor(node: ts.Node): void;
	/** `node` runs when the tracked signals change. */
	callback(node: ts.Node): void;
	/** `node` both reads the tracked signals and runs when they change. */
	effect(node: ts.Node): void;
}

export interface Rule {
	/** Matches the name of the called function. */
	name: RegExp;
	resolve(context: RuleContext): void;
}

const computedGetterName = 'get';

/** The reactivity APIs of Vue, VueUse and Pinia, tried in order on calls of an identifier. */
export const vueRules: Rule[] = [
	{
		name: /^(?:ref(?:[A-Z].*)?|createRef|customRef|extendRef|shallowRef|toRef|useTemplateRef|defineModel)$/,
		resolve(context) {
			resolveBinding(context, [valueAccess]);
		},
	},
	{
		name: /^(?:reactive(?:[A-Z].*)?|shallowReactive|toReactive|defineProps|withDefaults)$/,
		resolve(context) {
			resolveBinding(context, [anyPropertyAccess]);
		},
	},
	{
		name: /^(?:toRefs|storeToRefs)$/,
		resolve(context) {
			resolveBindingElements(context, [valueAccess]);
		},
	},
	{
		name: /^computedWithControl$/,
		resolve(context) {
			resolveBinding(context, [valueAccess]);
			const [source, getter] = context.call.arguments;
			if (source) {
				context.accessor(source);
			}
			if (getter) {
				resolveComputedGetter(context, getter);
			}
		},
	},
	{
		name: /^computed(?:[A-Z].*)?$/,
		resolve(context) {
			resolveBinding(context, [valueAccess]);
			const [getter] = context.call.arguments;
			if (getter) {
				resolveComputedGetter(context, getter);
			}
		},
	},
	{
		name: /^(?:effect|watchEffect)$/,
		resolve(context) {
			const [effect] = context.call.arguments;
			if (effect) {
				context.effect(effect);
			}
		},
	},
	{
		name: /^(?:watch(?:[A-Z].*)?|whenever)$/,
		resolve(context) {
			const [source, callback] = context.call.arguments;
			if (source) {
				context.accessor(source);
			}
			if (callback) {
				context.callback(callback);
			}
		},
	},
	{
		name: /^use[A-Z].*$/,
		resolve(context) {
			resolveBinding(context, [anyPropertyAccess]);
			resolveBindingElements(context, [valueAccess]);
		},
	},
];

function resolveBinding({ ts, binding, signal }: RuleContext, accesses: readonly Access[]) {
	if (binding && ts.isIdentifier(binding)) {
		signal(binding, accesses);
	}
}

/** Each identifier that an object pattern destructures the result to. */
function resolveBindingElements({ ts, binding, signal }: RuleContext, accesses: readonly Access[]) {
	if (binding && ts.isObjectBindingPattern(binding)) {
		for (const element of binding.elements) {
			if (ts.isBindingElement(element) && element.name && ts.isIdentifier(element.name)) {
				signal(element, accesses);
			}
		}
	}
}

/** The getter of a computed, or the `get` of its options. */
function resolveComputedGetter({ ts, effect }: RuleContext, node: ts.Node) {
	if (!ts.isObjectLiteralExpression(node)) {
		effect(node);
		return;
	}
	for (const property of node.properties) {
		if (ts.isPropertyAssignment(property) || ts.isMethodDeclaration(property)) {
			if (ts.isIdentifier(property.name) && property.name.text === computedGetterName) {
				effect(ts.isPropertyAssignment(property) ? property.initializer : property);
				return;
			}
		}
	}
}
