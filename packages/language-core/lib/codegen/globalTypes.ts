import type { VueCompilerOptions } from '../types';
import { getSlotsPropertyName } from '../utils/shared';

export function getGlobalTypesFileName({
	lib,
	target,
	checkUnknownProps,
	checkUnknownEvents,
	checkUnknownComponents,
}: VueCompilerOptions) {
	return [
		lib,
		target,
		checkUnknownProps,
		checkUnknownEvents,
		checkUnknownComponents,
	].map(v => (typeof v === 'boolean' ? Number(v) : v)).join('_') + '.d.ts';
}

export function generateGlobalTypes({
	lib,
	target,
	checkUnknownProps,
	checkUnknownEvents,
	checkUnknownComponents,
}: VueCompilerOptions) {
	const fnPropsType = `(K extends { $props: infer Props } ? Props : any)${checkUnknownProps ? '' : ' & Record<string, unknown>'}`;
	let text = ``;
	if (target < 3.5) {
		text += `
; declare module '${lib}' {
	export interface GlobalComponents { }
	export interface GlobalDirectives { }
}`;
	}
	text += `
; declare global {
	const __VLS_directiveBindingRestFields: { instance: null, oldValue: null, modifiers: any, dir: any };
	const __VLS_unref: typeof import('${lib}').unref;
	const __VLS_placeholder: any;

	type __VLS_NativeElements = __VLS_SpreadMerge<SVGElementTagNameMap, HTMLElementTagNameMap>;
	type __VLS_IntrinsicElements = ${(
			target >= 3.3
				? `import('${lib}/jsx-runtime').JSX.IntrinsicElements;`
				: `globalThis.JSX.IntrinsicElements;`
		)}
	type __VLS_Element = ${(
			target >= 3.3
				? `import('${lib}/jsx-runtime').JSX.Element;`
				: `globalThis.JSX.Element;`
		)}
	type __VLS_GlobalComponents = ${(
			target >= 3.5
				? `import('${lib}').GlobalComponents;`
				: `import('${lib}').GlobalComponents & Pick<typeof import('${lib}'), 'Transition' | 'TransitionGroup' | 'KeepAlive' | 'Suspense' | 'Teleport'>;`
		)}
	type __VLS_GlobalDirectives = import('${lib}').GlobalDirectives;
	type __VLS_IsAny<T> = 0 extends 1 & T ? true : false;
	type __VLS_PickNotAny<A, B> = __VLS_IsAny<A> extends true ? B : A;
	type __VLS_SpreadMerge<A, B> = Omit<A, keyof B> & B;
	type __VLS_WithComponent<N0 extends string, LocalComponents, Self, N1 extends string, N2 extends string, N3 extends string> =
		N1 extends keyof LocalComponents ? N1 extends N0 ? Pick<LocalComponents, N0 extends keyof LocalComponents ? N0 : never> : { [K in N0]: LocalComponents[N1] } :
		N2 extends keyof LocalComponents ? N2 extends N0 ? Pick<LocalComponents, N0 extends keyof LocalComponents ? N0 : never> : { [K in N0]: LocalComponents[N2] } :
		N3 extends keyof LocalComponents ? N3 extends N0 ? Pick<LocalComponents, N0 extends keyof LocalComponents ? N0 : never> : { [K in N0]: LocalComponents[N3] } :
		Self extends object ? { [K in N0]: Self } :
		N1 extends keyof __VLS_GlobalComponents ? N1 extends N0 ? Pick<__VLS_GlobalComponents, N0 extends keyof __VLS_GlobalComponents ? N0 : never> : { [K in N0]: __VLS_GlobalComponents[N1] } :
		N2 extends keyof __VLS_GlobalComponents ? N2 extends N0 ? Pick<__VLS_GlobalComponents, N0 extends keyof __VLS_GlobalComponents ? N0 : never> : { [K in N0]: __VLS_GlobalComponents[N2] } :
		N3 extends keyof __VLS_GlobalComponents ? N3 extends N0 ? Pick<__VLS_GlobalComponents, N0 extends keyof __VLS_GlobalComponents ? N0 : never> : { [K in N0]: __VLS_GlobalComponents[N3] } :
		${checkUnknownComponents ? '{}' : '{ [K in N0]: unknown }'};
	type __VLS_FunctionalComponentProps<T, K> =
		'__ctx' extends keyof __VLS_PickNotAny<K, {}> ? K extends { __ctx?: { props?: infer P } } ? NonNullable<P> : never
		: T extends (props: infer P, ...args: any) => any ? P :
		{};
	type __VLS_IsFunction<T, K> = K extends keyof T
		? __VLS_IsAny<T[K]> extends false
		? unknown extends T[K]
		? false
		: true
		: false
		: false;
	type __VLS_NormalizeComponentEvent<Props, Emits, onEvent extends keyof Props, Event extends keyof Emits, CamelizedEvent extends keyof Emits> = (
		__VLS_IsFunction<Props, onEvent> extends true
			? Props
			: __VLS_IsFunction<Emits, Event> extends true
				? { [K in onEvent]?: Emits[Event] }
				: __VLS_IsFunction<Emits, CamelizedEvent> extends true
					? { [K in onEvent]?: Emits[CamelizedEvent] }
					: Props
	)${checkUnknownEvents ? '' : ' & Record<string, unknown>'};
	// fix https://github.com/vuejs/language-tools/issues/926
	type __VLS_UnionToIntersection<U> = (U extends unknown ? (arg: U) => unknown : never) extends ((arg: infer P) => unknown) ? P : never;
	type __VLS_OverloadUnionInner<T, U = unknown> = U & T extends (...args: infer A) => infer R
		? U extends T
		? never
		: __VLS_OverloadUnionInner<T, Pick<T, keyof T> & U & ((...args: A) => R)> | ((...args: A) => R)
		: never;
	type __VLS_OverloadUnion<T> = Exclude<
		__VLS_OverloadUnionInner<(() => never) & T>,
		T extends () => never ? never : () => never
	>;
	type __VLS_ConstructorOverloads<T> = __VLS_OverloadUnion<T> extends infer F
		? F extends (event: infer E, ...args: infer A) => any
		? { [K in E & string]: (...args: A) => void; }
		: never
		: never;
	type __VLS_NormalizeEmits<T> = __VLS_PrettifyGlobal<
		__VLS_UnionToIntersection<
			__VLS_ConstructorOverloads<T> & {
				[K in keyof T]: T[K] extends any[] ? { (...args: T[K]): void } : never
			}
		>
	>;
	type __VLS_ResolveEmits<
		Comp,
		Emits,
		TypeEmits = ${target >= 3.6 ? `Comp extends { __typeEmits?: infer T } ? unknown extends T ? {} : import('${lib}').ShortEmitsToObject<T> : {}` : `{}`},
		NormalizedEmits = __VLS_NormalizeEmits<Emits> extends infer E ? string extends keyof E ? {} : E : never,
	> = __VLS_SpreadMerge<NormalizedEmits, TypeEmits>;
	type __VLS_PrettifyGlobal<T> = { [K in keyof T]: T[K]; } & {};
	type __VLS_PickFunctionalComponentCtx<T, K> = NonNullable<__VLS_PickNotAny<
		'__ctx' extends keyof __VLS_PickNotAny<K, {}> ? K extends { __ctx?: infer Ctx } ? Ctx : never : any
		, T extends (props: any, ctx: infer Ctx) => any ? Ctx : any
	>>;
	type __VLS_UseTemplateRef<T> = Readonly<import('${lib}').ShallowRef<T | null>>;

	function __VLS_getVForSourceType<T extends number | string | any[] | Iterable<any>>(source: T): [
		item: T extends number ? number
			: T extends string ? string
			: T extends any[] ? T[number]
			: T extends Iterable<infer T1> ? T1
			: any,
		index: number,
	][];
	function __VLS_getVForSourceType<T>(source: T): [
		item: T[keyof T],
		key: keyof T,
		index: number,
	][];
	// @ts-ignore
	function __VLS_getSlotParams<T>(slot: T): Parameters<__VLS_PickNotAny<NonNullable<T>, (...args: any[]) => any>>;
	// @ts-ignore
	function __VLS_getSlotParam<T>(slot: T): Parameters<__VLS_PickNotAny<NonNullable<T>, (...args: any[]) => any>>[0];
	function __VLS_asFunctionalDirective<T>(dir: T): T extends import('${lib}').ObjectDirective
		? NonNullable<T['created' | 'beforeMount' | 'mounted' | 'beforeUpdate' | 'updated' | 'beforeUnmount' | 'unmounted']>
		: T extends (...args: any) => any
			? T
			: (arg1: unknown, arg2: unknown, arg3: unknown, arg4: unknown) => void;
	function __VLS_makeOptional<T>(t: T): { [K in keyof T]?: T[K] };
	function __VLS_asFunctionalComponent<T, K = T extends new (...args: any) => any ? InstanceType<T> : unknown>(t: T, instance?: K):
		T extends new (...args: any) => any
		? (props: ${fnPropsType}, ctx?: any) => __VLS_Element & {
			__ctx?: {
				attrs?: any;
				slots?: K extends { ${getSlotsPropertyName(target)}: infer Slots } ? Slots : any;
				emit?: K extends { $emit: infer Emit } ? Emit : any;
				expose?(exposed: K): void;
				props?: ${fnPropsType};
			}
		}
		: T extends () => any ? (props: {}, ctx?: any) => ReturnType<T>
		: T extends (...args: any) => any ? T
		: (_: {}${checkUnknownProps ? '' : ' & Record<string, unknown>'}, ctx?: any) => { __ctx?: { attrs?: any, expose?: any, slots?: any, emit?: any, props?: {}${checkUnknownProps ? '' : ' & Record<string, unknown>'} } };
	function __VLS_functionalComponentArgsRest<T extends (...args: any) => any>(t: T): 2 extends Parameters<T>['length'] ? [any] : [];
	function __VLS_asFunctionalElement<T>(tag: T, endTag?: T): (attrs: T${checkUnknownComponents ? '' : ' & Record<string, unknown>'}) => void;
	function __VLS_asFunctionalSlot<S>(slot: S): S extends () => infer R ? (props: {}) => R : NonNullable<S>;
	function __VLS_tryAsConstant<const T>(t: T): T;
}
`;
	return text;
};
