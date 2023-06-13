import { VueCompilerOptions } from '../types';
import { getSlotsPropertyName } from './shared';

export const baseName = '__VLS_types.d.ts';

export function getTypesCode(vueCompilerOptions: VueCompilerOptions) {
	return `
// @ts-nocheck

type __VLS_IntrinsicElements = __VLS_PickNotAny<import('vue/jsx-runtime').JSX.IntrinsicElements, __VLS_PickNotAny<JSX.IntrinsicElements, Record<string, any>>>;
type __VLS_Element = __VLS_PickNotAny<import('vue/jsx-runtime').JSX.Element, JSX.Element>;

type __VLS_IsAny<T> = boolean extends (T extends never ? true : false) ? true : false;
type __VLS_PickNotAny<A, B> = __VLS_IsAny<A> extends true ? B : A;

type __VLS_Prettify<T> = {
	[K in keyof T]: T[K];
} & {};

declare module 'vue' {
	export interface GlobalComponents {}
}

declare module '@vue/runtime-core' {
	export interface GlobalComponents {}
}

declare module '@vue/runtime-dom' {
	export interface GlobalComponents {}
}

type __VLS_GlobalComponents =
	& __VLS_PickNotAny<import('vue').GlobalComponents, {}>
	& __VLS_PickNotAny<import('@vue/runtime-core').GlobalComponents, {}>
	& __VLS_PickNotAny<import('@vue/runtime-dom').GlobalComponents, {}>
	& Pick<typeof import('${vueCompilerOptions.lib}'),
		// @ts-ignore
		'Transition'
		| 'TransitionGroup'
		| 'KeepAlive'
		| 'Suspense'
		| 'Teleport'
	>;

// v-for
declare function __VLS_getVForSourceType(source: number): [number, number, number][];
declare function __VLS_getVForSourceType(source: string): [string, number, number][];
declare function __VLS_getVForSourceType<T extends any[]>(source: T): [
	T[number], // item
	number, // key
	number, // index
][];
declare function __VLS_getVForSourceType<T extends { [Symbol.iterator](): Iterator<any> }>(source: T): [
	T extends { [Symbol.iterator](): Iterator<infer T1> } ? T1 : never, // item 
	number, // key
	undefined, // index
][];
declare function __VLS_getVForSourceType<T>(source: T): [
	T[keyof T], // item
	keyof T, // key
	number, // index
][];

declare function __VLS_getSlotParams<T>(slot: T): Parameters<__VLS_PickNotAny<NonNullable<T>, (...args: any[]) => any>>;
declare function __VLS_getSlotParam<T>(slot: T): Parameters<__VLS_PickNotAny<NonNullable<T>, (...args: any[]) => any>>[0];
declare function __VLS_directiveFunction<T>(dir: T):
	T extends import('${vueCompilerOptions.lib}').ObjectDirective<infer E, infer V> | import('${vueCompilerOptions.lib}').FunctionDirective<infer E, infer V> ? (el: E, value: V) => void
	: T;
declare function __VLS_withScope<T, K>(ctx: T, scope: K): ctx is T & K;
declare function __VLS_makeOptional<T>(t: T): { [K in keyof T]?: T[K] };

type __VLS_SelfComponent<N, C> = string extends N ? {} : N extends string ? { [P in N]: C } : {};
type __VLS_WithComponent<N0 extends string, Components, N1 extends string, N2 extends string, N3 extends string> =
	N1 extends keyof Components ? N1 extends N0 ? Pick<Components, N0> : { [K in N0]: Components[N1] } :
	N2 extends keyof Components ? N2 extends N0 ? Pick<Components, N0> : { [K in N0]: Components[N2] } :
	N3 extends keyof Components ? N3 extends N0 ? Pick<Components, N0> : { [K in N0]: Components[N3] } :
	${vueCompilerOptions.strictTemplates ? '{}' : '{ [K in N0]: unknown }'}

type __VLS_FillingEventArg_ParametersLength<E extends (...args: any) => any> = __VLS_IsAny<Parameters<E>> extends true ? -1 : Parameters<E>['length'];
type __VLS_FillingEventArg<E> = E extends (...args: any) => any ? __VLS_FillingEventArg_ParametersLength<E> extends 0 ? ($event?: undefined) => ReturnType<E> : E : E;
type __VLS_EmitEvent<F, E> =
	F extends {
		(event: E, ...payload: infer P): any
	} ? (...payload: P) => void
	: F extends {
		(event: E, ...payload: infer P): any
		(...args: any): any
	} ? (...payload: P) => void
	: F extends {
		(event: E, ...payload: infer P): any
		(...args: any): any
		(...args: any): any
	} ? (...payload: P) => void
	: F extends {
		(event: E, ...payload: infer P): any
		(...args: any): any
		(...args: any): any
		(...args: any): any
	} ? (...payload: P) => void
	: unknown | '[Type Warning] Volar could not infer $emit event more than 4 overloads without DefineComponent. see https://github.com/vuejs/language-tools/issues/60';
declare function __VLS_asFunctionalComponent<T, K = T extends new (...args: any) => any ? InstanceType<T> : unknown>(t: T, instance?: K):
	T extends new (...args: any) => any
	? (props: (K extends { $props: infer Props } ? Props : any)${vueCompilerOptions.strictTemplates ? '' : ' & Record<string, unknown>'}, ctx?: {
		attrs?: any,
		slots?: K extends { ${getSlotsPropertyName(vueCompilerOptions.target)}: infer Slots } ? Slots : any,
		emit?: K extends { $emit: infer Emit } ? Emit : any
	}) => JSX.Element & { __ctx?: typeof ctx & { props?: typeof props; expose?(exposed: K): void; } }
	: T extends () => any ? (props: {}, ctx?: any) => ReturnType<T>
	: T extends (...args: any) => any ? T
	: (_: T extends import('${vueCompilerOptions.lib}').VNode | import('${vueCompilerOptions.lib}').VNode[] | string ? {}: T${vueCompilerOptions.strictTemplates ? '' : ' & Record<string, unknown>'}, ctx?: any) => { __ctx?: { attrs?: any, expose?: any, slots?: any, emit?: any, props?: T${vueCompilerOptions.strictTemplates ? '' : ' & Record<string, unknown>'} } }; // IntrinsicElement
declare function __VLS_functionalComponentArgsRest<T extends (...args: any) => any>(t: T): Parameters<T>['length'] extends 2 ? [any] : [];
declare function __VLS_pickEvent<Emit, K, E>(emit: Emit, emitKey: K, event: E): __VLS_FillingEventArg<
	__VLS_PickNotAny<
		__VLS_AsFunctionOrAny<E>,
		__VLS_AsFunctionOrAny<__VLS_EmitEvent<Emit, K>>
	>
>;
declare function __VLS_pickFunctionalComponentCtx<T, K>(comp: T, compInstance: K): __VLS_PickNotAny<
	K extends { __ctx?: infer Ctx } ? Ctx : any,
	T extends (props: any, ctx: infer Ctx) => any ? Ctx : any
>;
type __VLS_AsFunctionOrAny<F> = unknown extends F ? any : ((...args: any) => any) extends F ? F : any;

declare function __VLS_componentProps<T, K>(comp: T, fnReturn: K):
	__VLS_PickNotAny<K, {}> extends { __ctx: { props: infer P } } ? NonNullable<P>
	: T extends (props: infer P, ...args: any) => any ? NonNullable<P> :
	{};
`.trim();
}

// TODO: not working for overloads > n (n = 8)
// see: https://github.com/vuejs/language-tools/issues/60
export function genConstructorOverloads(name = 'ConstructorOverloads', nums?: number) {
	let code = '';
	code += `type ${name}<T> =\n`;
	if (nums === undefined) {
		for (let i = 8; i >= 1; i--) {
			gen(i);
		}
	}
	else if (nums > 0) {
		gen(nums);
	}
	code += `// 0\n`;
	code += `{};\n`;
	return code;

	function gen(i: number) {
		code += `// ${i}\n`;
		code += `T extends {\n`;
		for (let j = 1; j <= i; j++) {
			code += `(event: infer E${j}, ...payload: infer P${j}): void;\n`;
		}
		code += `} ? (\n`;
		for (let j = 1; j <= i; j++) {
			if (j > 1) code += '& ';
			code += `(E${j} extends string ? { [K${j} in E${j}]: (...payload: P${j}) => void } : {})\n`;
		}
		code += `) :\n`;
	}
}
