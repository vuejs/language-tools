import type * as CompilerDOM from '@vue/compiler-dom';
import type { Code } from '../../types';
import { codeFeatures } from '../codeFeatures';
import { names } from '../names';
import { endOfLine } from '../utils';
import { endBoundary, startBoundary } from '../utils/boundary';
import type { TemplateCodegenContext } from './context';

/** Each entry is a tuple member (possibly a spread) in the current render scope. */
export function* generateSlotChildrenCheck(
	node: CompilerDOM.ElementNode,
	slotType: string,
	children: string[],
): Generator<Code> {
	yield `((): ${names.SlotReturns}<${slotType}> => (`;
	const token = yield* startBoundary('template', node.loc.start.offset, codeFeatures.verification);
	yield `{} as ${names.ExpandSlotChildren}<[${children.join(', ')}], ${names.SlotReturns}<${slotType}>[number]>`;
	yield endBoundary(token, node.loc.end.offset);
	yield `))${endOfLine}`;
}

/** Capture block-local types in a function-scoped variable without moving code. */
export function* generateSlotChildrenVar(ctx: TemplateCodegenContext): Generator<Code, string> {
	const name = ctx.getInternalVariable();
	yield `var ${name} = {} as [${ctx.slotChildren!.join(', ')}]${endOfLine}`;
	return `typeof ${ctx.getHoistVariable(name)}`;
}

export function* generateMissingSlotChildrenCheck(
	node: CompilerDOM.ElementNode,
	contextType: string,
	providers: string[],
): Generator<Code> {
	yield `((): __VLS_MissingSlotChildren<${contextType}, ${providers.join(' & ') || '{}'}> => (`;
	const token = yield* startBoundary('template', node.loc.start.offset, codeFeatures.verification);
	yield `[]`;
	yield endBoundary(token, node.loc.end.offset);
	yield `))${endOfLine}`;
}

export function getSlotChildrenTypes(lib: string) {
	return `
	// RFC 734: descriptors stay separate from VNodes and never affect runtime code.
	type __VLS_SlotComponentIdentity<C> = C extends { __slotChildren: { id: infer I } } ? I
		: C extends (...args: any) => { __ctx?: { __slotChildren: { id: infer I } } } ? I : C;
	type __VLS_SlotElement<Tag extends string, Namespace extends number> = Namespace extends 1
		? Tag extends keyof SVGElementTagNameMap ? SVGElementTagNameMap[Tag] : SVGElement
		: Namespace extends 2 ? Tag extends keyof MathMLElementTagNameMap ? MathMLElementTagNameMap[Tag] : MathMLElement
		: Tag extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[Tag] : HTMLElement;
	type __VLS_SlotComponentProps<T> = T extends new(...args: any) => { $props: infer P } ? P
		: T extends (props: infer P, ...args: any) => any ? P : {};
	type __VLS_SlotChild<T> = T extends { __renders: { props: infer P; component: infer C } }
		? { component: __VLS_SlotComponentIdentity<C>; props: P }
		: T extends abstract new(...args: any) => any ? { component: __VLS_SlotComponentIdentity<T>; props: __VLS_SlotComponentProps<T> }
		: T extends (...args: any) => any ? { component: __VLS_SlotComponentIdentity<T>; props: __VLS_SlotComponentProps<T> }
		: T extends Element ? { element: T }
		: T extends string | Text ? { text: string }
		: T extends import('${lib}').VNode ? {}
		: T;
	type __VLS_SlotReturn<T> = unknown extends T ? unknown[]
		: T extends readonly unknown[] ? { [K in keyof T]: __VLS_SlotChild<T[K]> }
		: T extends null | undefined | false | void ? []
		: [__VLS_SlotChild<T>];
	type __VLS_SlotReturns<S> = (0 extends 1 & S ? true : false) extends true ? unknown[]
		: NonNullable<S> extends (...args: any) => infer R ? __VLS_SlotReturn<R> : unknown[];
	type __VLS_DeclaredSlots<S> = { [K in keyof S as string extends K ? never : number extends K ? never : K]: S[K] };
	type __VLS_MissingSlotNames<S, P> = P extends unknown ? {
		[K in keyof S]-?: undefined extends S[K] ? never : [] extends __VLS_SlotReturns<S[K]> ? never
			: K extends keyof P ? undefined extends P[K] ? K : never : K
	}[keyof S] : never;
	type __VLS_MissingSlotChildren<C, P> = C extends { slots?: infer S }
		? [__VLS_MissingSlotNames<__VLS_DeclaredSlots<NonNullable<S>>, P>] extends [never] ? [] : [missing: __VLS_MissingSlotNames<__VLS_DeclaredSlots<NonNullable<S>>, P>]
		: [];
	type __VLS_ExpandProvidedSlot<C extends readonly unknown[], E, Seen, Env, F> = C extends readonly [] ? F
		: __VLS_ExpandSlotChildren<C, E, Seen, Env> | ([] extends C ? F : never);
	type __VLS_ExpandSlotOutlet<C, E, Seen, Env> = C extends { outlet: infer N; declared: infer D; fallback: infer F extends readonly unknown[] }
		? Env extends { slots: infer S; parent: infer P; seen: infer OuterSeen }
			? N extends keyof S
				? __VLS_ExpandProvidedSlot<
					__VLS_ExpandSlotChildren<Extract<S[N], readonly unknown[]>, unknown, OuterSeen, P>,
					E, OuterSeen, P, __VLS_ExpandSlotChildren<F, E, Seen, Env>>
					| (undefined extends S[N] ? __VLS_ExpandSlotChildren<F, E, Seen, Env> : never)
				: __VLS_ExpandSlotChildren<F, E, Seen, Env>
			: N extends keyof D
				? __VLS_ExpandSlotChildren<__VLS_SlotReturns<D[N]>, E, Seen, Env>
					| (undefined extends D[N] ? __VLS_ExpandSlotChildren<F, E, Seen, Env> : never)
				: unknown[]
		: never;
	type __VLS_ExpandSlotChild<C, E, Seen, Env> = C extends { component: infer I }
		? I extends unknown ? __VLS_ExpandSlotChildVariant<C & { component: I }, E, Seen, Env> : never
		: __VLS_ExpandSlotChildVariant<C, E, Seen, Env>;
	type __VLS_ExpandSlotChildVariant<C, E, Seen, Env> = C extends { outlet: unknown }
		? __VLS_ExpandSlotOutlet<C, E, Seen, Env>
		: C extends E ? [C]
		: C extends { renders: infer R; slots: infer S } ? [R] extends [never] ? [C]
			: R extends { id: infer I; children: infer Children extends readonly unknown[] }
				? [Children] extends [never] ? [C] : I extends Seen ? [unknown] : __VLS_ExpandSlotChildren<Children, E, Seen | I, { slots: S; parent: Env; seen: Seen }>
				: [C]
		: [C];
	type __VLS_ExpandSlotChildren<C extends readonly unknown[], E, Seen = never, Env = undefined> =
		C extends readonly [infer H, ...infer T]
			? [...__VLS_ExpandSlotChild<H, E, Seen, Env>, ...__VLS_ExpandSlotChildren<T, E, Seen, Env>]
			: C extends readonly [...infer H, infer T]
				? [...__VLS_ExpandSlotChildren<H, E, Seen, Env>, ...__VLS_ExpandSlotChild<T, E, Seen, Env>]
				: number extends C['length'] ? __VLS_ExpandSlotChild<C[number], E, Seen, Env>[number][]
					: [];

`;
}
