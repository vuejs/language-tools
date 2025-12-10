import type { VueCompilerOptions } from '../types';
import * as names from './names';
import { endOfLine, newLine } from './utils';

export function getGlobalTypesFileName(options: VueCompilerOptions) {
	return [
		options.lib,
		options.target,
	].join('_') + '.d.ts';
}

export function generateGlobalTypes(options: VueCompilerOptions) {
	const { lib, target } = options;

	let text = `// @ts-nocheck${newLine}`;
	text += `export {}${endOfLine}`;

	if (target < 3.5) {
		text += `declare module '${lib}' {
	export interface GlobalComponents { }
	export interface GlobalDirectives { }
}${newLine}`;
	}

	text += `declare global {
	var ${names.PROPS_FALLBACK}: Record<string, unknown>;

	const __VLS_directiveBindingRestFields: { instance: null, oldValue: null, modifiers: any, dir: any };
	const ${names.placeholder}: any;
	const ${names.intrinsics}: ${
		target >= 3.3
			? `import('${lib}/jsx-runtime').JSX.IntrinsicElements`
			: `globalThis.JSX.IntrinsicElements`
	};

	type __VLS_Elements = __VLS_SpreadMerge<SVGElementTagNameMap, HTMLElementTagNameMap>;
	type __VLS_GlobalComponents = ${
		target >= 3.5
			? `import('${lib}').GlobalComponents`
			: `import('${lib}').GlobalComponents & Pick<typeof import('${lib}'), 'Transition' | 'TransitionGroup' | 'KeepAlive' | 'Suspense' | 'Teleport'>`
	};
	type __VLS_GlobalDirectives = import('${lib}').GlobalDirectives;
	type __VLS_IsAny<T> = 0 extends 1 & T ? true : false;
	type __VLS_PickNotAny<A, B> = __VLS_IsAny<A> extends true ? B : A;
	type __VLS_SpreadMerge<A, B> = Omit<A, keyof B> & B;
	type __VLS_WithComponent<N0 extends string, LocalComponents, Self, N1 extends string, N2 extends string = N1, N3 extends string = N1> =
		N1 extends keyof LocalComponents ? { [K in N0]: LocalComponents[N1] } :
		N2 extends keyof LocalComponents ? { [K in N0]: LocalComponents[N2] } :
		N3 extends keyof LocalComponents ? { [K in N0]: LocalComponents[N3] } :
		Self extends object ? { [K in N0]: Self } :
		N1 extends keyof __VLS_GlobalComponents ? { [K in N0]: __VLS_GlobalComponents[N1] } :
		N2 extends keyof __VLS_GlobalComponents ? { [K in N0]: __VLS_GlobalComponents[N2] } :
		N3 extends keyof __VLS_GlobalComponents ? { [K in N0]: __VLS_GlobalComponents[N3] } :
		{};
	type __VLS_FunctionalComponentCtx<T, K> = __VLS_PickNotAny<'__ctx' extends keyof __VLS_PickNotAny<K, {}>
		? K extends { __ctx?: infer Ctx } ? NonNullable<Ctx> : never : any
		, T extends (props: any, ctx: infer Ctx) => any ? Ctx : any
	>;
	type __VLS_FunctionalComponentProps<T, K> = '__ctx' extends keyof __VLS_PickNotAny<K, {}>
		? K extends { __ctx?: { props?: infer P } } ? NonNullable<P> : never
		: T extends (props: infer P, ...args: any) => any ? P
		: {};
	type __VLS_FunctionalComponent0<T> = (props: (T extends { $props: infer Props } ? Props : {}), ctx?: any) => ${
		target >= 3.3
			? `import('${lib}/jsx-runtime').JSX.Element`
			: `globalThis.JSX.Element`
	} & {
		__ctx?: {
			attrs?: any;
			slots?: T extends { $slots: infer Slots } ? Slots : Record<string, any>;
			emit?: T extends { $emit: infer Emit } ? Emit : {};
			props?: typeof props;
			expose?: (exposed: T) => void;
		};
	};
	type __VLS_FunctionalComponent1<T> = (props: (T extends { $props: infer Props } ? Props : {}) & Record<string, unknown>, ctx?: any) => ${
		target >= 3.3
			? `import('${lib}/jsx-runtime').JSX.Element`
			: `globalThis.JSX.Element`
	} & {
		__ctx?: {
			attrs?: any;
			slots?: T extends { $slots: infer Slots } ? Slots : Record<string, any>;
			emit?: T extends { $emit: infer Emit } ? Emit : {};
			props?: typeof props;
			expose?: (exposed: T) => void;
		};
	};
	type __VLS_IsFunction<T, K> = K extends keyof T
		? __VLS_IsAny<T[K]> extends false
		? unknown extends T[K]
		? false
		: true
		: false
		: false;
	type __VLS_NormalizeComponentEvent<
		Props,
		Emits,
		onEvent extends keyof Props,
		Event extends keyof Emits,
		CamelizedEvent extends keyof Emits,
	> = __VLS_IsFunction<Props, onEvent> extends true
		? Props
		: __VLS_IsFunction<Emits, Event> extends true
			? { [K in onEvent]?: Emits[Event] }
			: __VLS_IsFunction<Emits, CamelizedEvent> extends true
				? { [K in onEvent]?: Emits[CamelizedEvent] }
				: Props;
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
	type __VLS_EmitsToProps<T> = __VLS_PrettifyGlobal<{
		[K in string & keyof T as \`on\${Capitalize<K>}\`]?:
			(...args: T[K] extends (...args: infer P) => any ? P : T[K] extends null ? any[] : never) => any;
	}>;
	type __VLS_ResolveEmits<
		Comp,
		Emits,
		TypeEmits = ${
		target >= 3.6
			? `Comp extends { __typeEmits?: infer T } ? unknown extends T ? {} : import('${lib}').ShortEmitsToObject<T> : {}`
			: `{}`
	},
		NormalizedEmits = __VLS_NormalizeEmits<Emits> extends infer E ? string extends keyof E ? {} : E : never,
	> = __VLS_SpreadMerge<NormalizedEmits, TypeEmits>;
	type __VLS_ResolveDirectives<T> = {
		[K in keyof T & string as \`v\${Capitalize<K>}\`]: T[K];
	};
	type __VLS_PrettifyGlobal<T> = (T extends any ? { [K in keyof T]: T[K]; } : { [K in keyof T as K]: T[K]; }) & {};
	type __VLS_UseTemplateRef<T> = Readonly<import('${lib}').ShallowRef<T | null>>;
	type __VLS_ProxyRefs<T> = import('${lib}').ShallowUnwrapRef<T>;

	function __VLS_vFor<T>(source: T):
		T extends number ? [number, number][]
		: T extends string ? [string, number][]
		: T extends any[] ? [T[number], number][]
		: T extends Iterable<infer V> ? [V, number][]
		: [T[keyof T], \`\${keyof T}\`, number][];
	function __VLS_vSlot<S, D extends S>(slot: S, decl?: D):
		D extends (...args: infer P) => any ? P : any[];
	function __VLS_asFunctionalDirective<T>(dir: T): T extends import('${lib}').ObjectDirective
		? NonNullable<T['created' | 'beforeMount' | 'mounted' | 'beforeUpdate' | 'updated' | 'beforeUnmount' | 'unmounted']>
		: T extends (...args: any) => any
			? T
			: (arg1: unknown, arg2: unknown, arg3: unknown, arg4: unknown) => void;
	function __VLS_asFunctionalComponent0<T, K = T extends new (...args: any) => any ? InstanceType<T> : unknown>(t: T, instance?: K):
		T extends new (...args: any) => any ? __VLS_FunctionalComponent0<K>
		: T extends () => any ? (props: {}, ctx?: any) => ReturnType<T>
		: T extends (...args: any) => any ? T
		: __VLS_FunctionalComponent0<{}>;
	function __VLS_asFunctionalComponent1<T, K = T extends new (...args: any) => any ? InstanceType<T> : unknown>(t: T, instance?: K):
		T extends new (...args: any) => any ? __VLS_FunctionalComponent1<K>
		: T extends () => any ? (props: {}, ctx?: any) => ReturnType<T>
		: T extends (...args: any) => any ? T
		: __VLS_FunctionalComponent1<{}>;
	function __VLS_functionalComponentArgsRest<T extends (...args: any) => any>(t: T): 2 extends Parameters<T>['length'] ? [any] : [];
	function __VLS_asFunctionalElement0<T>(tag: T, endTag?: T): (attrs: T) => void;
	function __VLS_asFunctionalElement1<T>(tag: T, endTag?: T): (attrs: T & Record<string, unknown>) => void;
	function __VLS_asFunctionalSlot<S>(slot: S): S extends () => infer R ? (props: {}) => R : NonNullable<S>;
	function __VLS_tryAsConstant<const T>(t: T): T;
}${newLine}`;

	return text;
}
