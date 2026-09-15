import type { VueCompilerOptions } from '../types';
import { endOfLine } from './utils';

export function getLocalTypesGenerator(vueCompilerOptions: VueCompilerOptions) {
	const used = new Set<string>();

	const WithDefaults = defineHelper(
		`__VLS_WithDefaults`,
		() =>
			`
type __VLS_WithDefaults<P, D> = {
	[K in keyof Pick<P, keyof P>]: K extends keyof D
		? ${PrettifyLocal.name}<P[K] & { default: D[K] }>
		: P[K]
};
`.trimStart(),
	);
	const PrettifyLocal = defineHelper(
		`__VLS_PrettifyLocal`,
		() =>
			`type __VLS_PrettifyLocal<T> = (T extends any ? { [K in keyof T]: T[K]; } : { [K in keyof T as K]: T[K]; }) & {}${endOfLine}`,
	);
	const WithSlots = defineHelper(
		`__VLS_WithSlots`,
		() =>
			`
type __VLS_WithSlots<T, S> = T & {
	new(): {
		$slots: S;
	}
};
`.trimStart(),
	);
	const PropsChildren = defineHelper(
		`__VLS_PropsChildren`,
		() =>
			`
type __VLS_PropsChildren<S> = {
	[K in keyof (
		boolean extends (
			// @ts-ignore
			JSX.ElementChildrenAttribute extends never
				? true
				: false
		)
			? never
			// @ts-ignore
			: JSX.ElementChildrenAttribute
	)]?: S;
};
`.trimStart(),
	);
	const TypePropsToOption = defineHelper(
		`__VLS_TypePropsToOption`,
		() =>
			`
type __VLS_TypePropsToOption<T> = {
	[K in keyof T]-?: {} extends Pick<T, K>
		? { type: import('${vueCompilerOptions.lib}').PropType<Required<T>[K]> }
		: { type: import('${vueCompilerOptions.lib}').PropType<T[K]>, required: true }
};
`.trimStart(),
	);
	const OmitIndexSignature = defineHelper(
		`__VLS_OmitIndexSignature`,
		() =>
			`type __VLS_OmitIndexSignature<T> = { [K in keyof T as {} extends Record<K, unknown> ? never : K]: T[K]; }${endOfLine}`,
	);
	const SlotComponentIdentity = defineHelper(
		`__VLS_SlotComponentIdentity`,
		() =>
			`
// RFC 734: descriptors stay separate from VNodes and never affect runtime code.
type __VLS_SlotComponentIdentity<C> = C extends { __slotChildren: { id: infer I } } ? I
	: C extends (...args: any) => { __ctx?: { __slotChildren: { id: infer I } } } ? I : C;
`.trimStart(),
	);
	const SlotElement = defineHelper(
		`__VLS_SlotElement`,
		() =>
			`
type __VLS_SlotElement<Tag extends string, Namespace extends number> = Namespace extends 1
	? Tag extends keyof SVGElementTagNameMap ? SVGElementTagNameMap[Tag] : SVGElement
	: Namespace extends 2 ? Tag extends keyof MathMLElementTagNameMap ? MathMLElementTagNameMap[Tag] : MathMLElement
	: Tag extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[Tag] : HTMLElement;
`.trimStart(),
	);
	const SlotComponentProps = defineHelper(
		`__VLS_SlotComponentProps`,
		() =>
			`
type __VLS_SlotComponentProps<T> = T extends new(...args: any) => { $props: infer P } ? P
	: T extends (props: infer P, ...args: any) => any ? P : {};
`.trimStart(),
	);
	const SlotChild = defineHelper(
		`__VLS_SlotChild`,
		() =>
			`
type __VLS_SlotChild<T> = T extends { __renders: { props: infer P; component: infer C } }
	? { component: ${SlotComponentIdentity.name}<C>; props: P }
	: T extends abstract new(...args: any) => any ? { component: ${SlotComponentIdentity.name}<T>; props: ${SlotComponentProps.name}<T> }
	: T extends (...args: any) => any ? { component: ${SlotComponentIdentity.name}<T>; props: ${SlotComponentProps.name}<T> }
	: T extends Element ? { element: T }
	: T extends string | Text ? { text: string }
	: T extends import('${vueCompilerOptions.lib}').VNode ? {}
	: T;
`.trimStart(),
	);
	const SlotReturn = defineHelper(
		`__VLS_SlotReturn`,
		() =>
			`
type __VLS_SlotReturn<T> = unknown extends T ? unknown[]
	: T extends readonly unknown[] ? { [K in keyof T]: ${SlotChild.name}<T[K]> }
	: T extends null | undefined | false | void ? []
	: [${SlotChild.name}<T>];
`.trimStart(),
	);
	const SlotReturns = defineHelper(
		`__VLS_SlotReturns`,
		() =>
			`
type __VLS_SlotReturns<S> = (0 extends 1 & S ? true : false) extends true ? unknown[]
	: NonNullable<S> extends (...args: any) => infer R ? ${SlotReturn.name}<R> : unknown[];
`.trimStart(),
	);
	const SlotProvider = defineHelper(
		`__VLS_SlotProvider`,
		() =>
			`
type __VLS_SlotProvider<N extends PropertyKey, C> = string extends N ? Partial<Record<N, C>>
	: N extends unknown ? { [K in N]: C } : never;
`.trimStart(),
	);
	const DeclaredSlots = defineHelper(
		`__VLS_DeclaredSlots`,
		() =>
			`
type __VLS_DeclaredSlots<S> = { [K in keyof S as string extends K ? never : number extends K ? never : K]: S[K] };
`.trimStart(),
	);
	const MissingSlotNames = defineHelper(
		`__VLS_MissingSlotNames`,
		() =>
			`
type __VLS_MissingSlotNames<S, P> = P extends unknown ? {
	[K in keyof S]-?: undefined extends S[K] ? never : [] extends ${SlotReturns.name}<S[K]> ? never
		: K extends keyof P ? undefined extends P[K] ? K : never : K
}[keyof S] : never;
`.trimStart(),
	);
	const MissingSlotChildren = defineHelper(
		`__VLS_MissingSlotChildren`,
		() =>
			`
type __VLS_MissingSlotChildren<C, P> = C extends { slots?: infer S }
	? [${MissingSlotNames.name}<${DeclaredSlots.name}<NonNullable<S>>, P>] extends [never] ? [] : [missing: ${MissingSlotNames.name}<${DeclaredSlots.name}<NonNullable<S>>, P>]
	: [];
`.trimStart(),
	);
	const ExpandProvidedSlot = defineHelper(
		`__VLS_ExpandProvidedSlot`,
		() =>
			`
type __VLS_ExpandProvidedSlot<C extends readonly unknown[], E extends readonly unknown[], Seen, Env, F, Offset extends unknown[]> = C extends readonly [] ? F
	: ${ExpandSlotChildren.name}<C, E, Seen, Env, Offset> | ([] extends C ? F : never);
`.trimStart(),
	);
	const ExpandSlotOutlet = defineHelper(
		`__VLS_ExpandSlotOutlet`,
		() =>
			`
type __VLS_ExpandSlotOutlet<C, E extends readonly unknown[], Seen, Env, Offset extends unknown[]> = C extends { outlet: infer N; declared: infer D; fallback: infer F extends readonly unknown[] }
	? Env extends { slots: infer S; parent: infer P; seen: infer OuterSeen }
		? N extends keyof S
			? ${ExpandProvidedSlot.name}<
				${ExpandSlotChildren.name}<Extract<S[N], readonly unknown[]>, unknown[], OuterSeen, P>,
				E, OuterSeen, P, ${ExpandSlotChildren.name}<F, E, Seen, Env, Offset>, Offset>
				| (undefined extends S[N] ? ${ExpandSlotChildren.name}<F, E, Seen, Env, Offset> : never)
			: ${ExpandSlotChildren.name}<F, E, Seen, Env, Offset>
		: N extends keyof D
			? ${ExpandProvidedSlot.name}<${SlotReturns.name}<D[N]>, E, Seen, Env, ${ExpandSlotChildren.name}<F, E, Seen, Env, Offset>, Offset>
				| (undefined extends D[N] ? ${ExpandSlotChildren.name}<F, E, Seen, Env, Offset> : never)
			: unknown[]
	: never;
`.trimStart(),
	);
	const ExpandSlotChild = defineHelper(
		`__VLS_ExpandSlotChild`,
		() =>
			`
type __VLS_ExpandSlotChild<C, E extends readonly unknown[], Seen, Env, Offset extends unknown[]> = C extends { component: infer I }
	? I extends unknown ? ${ExpandSlotChildVariant.name}<C & { component: I }, E, Seen, Env, Offset> : never
	: ${ExpandSlotChildVariant.name}<C, E, Seen, Env, Offset>;
`.trimStart(),
	);
	const ExpandSlotChildVariant = defineHelper(
		`__VLS_ExpandSlotChildVariant`,
		() =>
			`
type __VLS_ExpandSlotChildVariant<C, E extends readonly unknown[], Seen, Env, Offset extends unknown[]> = C extends { outlet: unknown }
	? ${ExpandSlotOutlet.name}<C, E, Seen, Env, Offset>
	: C extends E[Offset['length']] ? [C]
	: C extends { renders: infer R; slots: infer S } ? [R] extends [never] ? [C]
		: R extends { id: infer I; children: infer Children extends readonly unknown[] }
			? [Children] extends [never] ? [C] : I extends Seen ? [unknown]
				: S extends unknown ? ${ExpandSlotChildren.name}<Children, E, Seen | I, { slots: S; parent: Env; seen: Seen }, Offset> : never
			: [C]
	: [C];
`.trimStart(),
	);
	const ExpandSlotRest = defineHelper(
		`__VLS_ExpandSlotRest`,
		() =>
			`
type __VLS_ExpandSlotRest<H extends readonly unknown[], T extends readonly unknown[], E extends readonly unknown[], Seen, Env, Offset extends unknown[]> = H extends unknown
	? [...H, ...${ExpandSlotChildren.name}<T, E, Seen, Env, [...Offset, ...H]>] : never;
`.trimStart(),
	);
	const ExpandSlotChildren = defineHelper(
		`__VLS_ExpandSlotChildren`,
		() =>
			`
type __VLS_ExpandSlotChildren<C extends readonly unknown[], E extends readonly unknown[], Seen = never, Env = undefined, Offset extends unknown[] = []> =
	C extends readonly [infer H, ...infer T]
		? ${ExpandSlotRest.name}<${ExpandSlotChild.name}<H, E, Seen, Env, Offset>, T, E, Seen, Env, Offset>
		: C extends readonly [...infer H, infer T]
			? ${ExpandSlotRest.name}<${ExpandSlotChildren.name}<H, E, Seen, Env, Offset>, [T], E, Seen, Env, Offset>
			: number extends C['length'] ? ${ExpandSlotChild.name}<C[number], E, Seen, Env, Offset>[number][]
				: [];
`.trimStart(),
	);
	const MatchingSlotExpansion = defineHelper(
		`__VLS_MatchingSlotExpansion`,
		() =>
			`
type __VLS_MatchingSlotExpansion<C extends readonly unknown[], T extends readonly unknown[], E = T> = T extends unknown
	? ${ExpandSlotChildren.name}<C, T> extends infer R ? [R] extends [E] ? R : never : never
	: never;
`.trimStart(),
	);
	const SlotChildrenResult = defineHelper(
		`__VLS_SlotChildrenResult`,
		() =>
			`
// Each candidate must cover every render path before selecting a tuple alternative.
type __VLS_SlotChildrenResult<C extends readonly unknown[], E extends readonly unknown[], R = ${ExpandSlotChildren.name}<C, E[number][]>> =
	[R] extends [E] ? R : ${MatchingSlotExpansion.name}<C, E> extends infer P
		? [P] extends [never] ? ${ExpandSlotChildren.name}<C, E> : P : never;
`.trimStart(),
	);
	const SlotChildrenFailure = defineHelper(
		`__VLS_SlotChildrenFailure`,
		() =>
			`
// Union slot functions (dynamic names or components) must all accept the children.
// One function returning a union still permits any of its return alternatives.
type __VLS_SlotChildrenFailure<C extends readonly unknown[], S> = S extends (...args: any) => infer R
	? [${SlotChildrenResult.name}<C, ${SlotReturn.name}<R>>] extends [${SlotReturn.name}<R>] ? never : { expected: ${SlotReturn.name}<R> }
	: never;
`.trimStart(),
	);
	const SlotChildrenCheck = defineHelper(
		`__VLS_SlotChildrenCheck`,
		() =>
			`
type __VLS_SlotChildrenCheck<C extends readonly unknown[], S> =
	[${SlotChildrenFailure.name}<C, NonNullable<S>>] extends [never] ? [] : [invalid: ${SlotChildrenFailure.name}<C, NonNullable<S>>];
`.trimStart(),
	);
	const helpers = {
		[SlotComponentIdentity.name]: SlotComponentIdentity,
		[SlotElement.name]: SlotElement,
		[SlotComponentProps.name]: SlotComponentProps,
		[SlotChild.name]: SlotChild,
		[SlotReturn.name]: SlotReturn,
		[SlotReturns.name]: SlotReturns,
		[SlotProvider.name]: SlotProvider,
		[DeclaredSlots.name]: DeclaredSlots,
		[MissingSlotNames.name]: MissingSlotNames,
		[MissingSlotChildren.name]: MissingSlotChildren,
		[ExpandProvidedSlot.name]: ExpandProvidedSlot,
		[ExpandSlotOutlet.name]: ExpandSlotOutlet,
		[ExpandSlotChild.name]: ExpandSlotChild,
		[ExpandSlotChildVariant.name]: ExpandSlotChildVariant,
		[ExpandSlotRest.name]: ExpandSlotRest,
		[ExpandSlotChildren.name]: ExpandSlotChildren,
		[MatchingSlotExpansion.name]: MatchingSlotExpansion,
		[SlotChildrenResult.name]: SlotChildrenResult,
		[SlotChildrenFailure.name]: SlotChildrenFailure,
		[SlotChildrenCheck.name]: SlotChildrenCheck,
		[PrettifyLocal.name]: PrettifyLocal,
		[WithDefaults.name]: WithDefaults,
		[WithSlots.name]: WithSlots,
		[PropsChildren.name]: PropsChildren,
		[TypePropsToOption.name]: TypePropsToOption,
		[OmitIndexSignature.name]: OmitIndexSignature,
	};
	used.clear();

	return {
		generate,
		get SlotElement() {
			return SlotElement.name;
		},
		get SlotProvider() {
			return SlotProvider.name;
		},
		get SlotChildrenCheck() {
			return SlotChildrenCheck.name;
		},
		get MissingSlotChildren() {
			return MissingSlotChildren.name;
		},
		get PrettifyLocal() {
			return PrettifyLocal.name;
		},
		get WithDefaults() {
			return WithDefaults.name;
		},
		get WithSlots() {
			return WithSlots.name;
		},
		get PropsChildren() {
			return PropsChildren.name;
		},
		get TypePropsToOption() {
			return TypePropsToOption.name;
		},
		get OmitIndexSignature() {
			return OmitIndexSignature.name;
		},
	};

	function* generate() {
		for (const name of used) {
			yield helpers[name]!.generate();
		}
		used.clear();
	}

	function defineHelper(name: string, generate: () => string) {
		return {
			get name() {
				used.add(name);
				return name;
			},
			generate,
		};
	}
}
