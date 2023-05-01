import { VueCompilerOptions } from '../types';
import { getSlotsPropertyName } from './shared';
import type * as ts from 'typescript/lib/tsserverlibrary';

export const baseName = '__VLS_types.d.ts';

export function getImportName(compilerOptions: ts.CompilerOptions) {
	if (!compilerOptions.module || compilerOptions.module === 1) {
		return './__VLS_types';
	}
	return './__VLS_types.js';
};

export function getTypesCode(vueCompilerOptions: VueCompilerOptions) {
	return `
// @ts-nocheck
import type {
	ObjectDirective,
	FunctionDirective,
	VNode,
} from '${vueCompilerOptions.lib}';

export type IntrinsicElements = PickNotAny<import('vue/jsx-runtime').JSX.IntrinsicElements, PickNotAny<JSX.IntrinsicElements, Record<string, any>>>;
export type Element = PickNotAny<import('vue/jsx-runtime').JSX.Element, JSX.Element>;

type IsAny<T> = boolean extends (T extends never ? true : false) ? true : false;
export type PickNotAny<A, B> = IsAny<A> extends true ? B : A;

export type Prettify<T> = {
	[K in keyof T]: T[K];
} & {};

export type GlobalComponents =
	// @ts-ignore
	PickNotAny<import('vue').GlobalComponents, {}>
	// @ts-ignore
	& PickNotAny<import('@vue/runtime-core').GlobalComponents, {}>
	// @ts-ignore
	& PickNotAny<import('@vue/runtime-dom').GlobalComponents, {}>
	& Pick<typeof import('${vueCompilerOptions.lib}'),
		// @ts-ignore
		'Transition'
		| 'TransitionGroup'
		| 'KeepAlive'
		| 'Suspense'
		| 'Teleport'
	>;

// v-for
export declare function getVForSourceType(source: number): [number, number, number][];
export declare function getVForSourceType(source: string): [string, number, number][];
export declare function getVForSourceType<T extends { [Symbol.iterator](): Iterator<any> }>(source: T): [
	T extends { [Symbol.iterator](): Iterator<infer T1> } ? T1 : never, // item 
	number, // key
	undefined, // index
][];
export declare function getVForSourceType<T>(source: T): [
	T extends any ? T[keyof T] : never, // item
	T extends any ? keyof T : never, // key
	number, // index
][];

export declare function getSlotParams<T>(slot: T): Parameters<PickNotAny<NonNullable<T>, (...args: any[]) => any>>;
export declare function getSlotParam<T>(slot: T): Parameters<PickNotAny<NonNullable<T>, (...args: any[]) => any>>[0];
export declare function directiveFunction<T>(dir: T):
	T extends ObjectDirective<infer E, infer V> | FunctionDirective<infer E, infer V> ? (el: E, value: V) => void
	: T;
export declare function withScope<T, K>(ctx: T, scope: K): ctx is T & K;
export declare function makeOptional<T>(t: T): { [K in keyof T]?: T[K] };

export type SelfComponent<N, C> = string extends N ? {} : N extends string ? { [P in N]: C } : {};
export type WithComponent<N0 extends string, Components, N1 extends string, N2 extends string, N3 extends string> =
	IsAny<IntrinsicElements[N0]> extends true ? (
		N1 extends keyof Components ? N1 extends N0 ? Pick<Components, N0> : { [K in N0]: Components[N1] } :
		N2 extends keyof Components ? N2 extends N0 ? Pick<Components, N0> : { [K in N0]: Components[N2] } :
		N3 extends keyof Components ? N3 extends N0 ? Pick<Components, N0> : { [K in N0]: Components[N3] } :
		${vueCompilerOptions.strictTemplates ? '{}' : '{ [K in N0]: any }'}
	) : Pick<IntrinsicElements, N0>;

export type FillingEventArg_ParametersLength<E extends (...args: any) => any> = IsAny<Parameters<E>> extends true ? -1 : Parameters<E>['length'];
export type FillingEventArg<E> = E extends (...args: any) => any ? FillingEventArg_ParametersLength<E> extends 0 ? ($event?: undefined) => ReturnType<E> : E : E;
export type EmitEvent<F, E> =
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
	: unknown | '[Type Warning] Volar could not infer $emit event more than 4 overloads without DefineComponent. see https://github.com/johnsoncodehk/volar/issues/60';
export declare function asFunctionalComponent<T, K = T extends new (...args: any) => any ? InstanceType<T> : unknown>(t: T, instance?: K):
	T extends new (...args: any) => any
	? (props: (K extends { $props: infer Props } ? Props : any)${vueCompilerOptions.strictTemplates ? '' : ' & Record<string, unknown>'}, ctx?: {
		attrs?: any,
		slots?: K extends { ${getSlotsPropertyName(vueCompilerOptions.target)}: infer Slots } ? Slots : any,
		emit?: K extends { $emit: infer Emit } ? Emit : any
	}) => JSX.Element & { __ctx?: typeof ctx & { props?: typeof props; expose?(exposed: K): void; } }
	: T extends () => any ? (props: {}, ctx?: any) => ReturnType<T>
	: T extends (...args: any) => any ? T
	: (_: T extends VNode | VNode[] | string ? {}: T & Record<string, unknown>, ctx?: any) => { __ctx?: { attrs?: unknown, expose?: unknown, slots?: unknown, emit?: unknown, props?: T & Record<string, unknown> } }; // IntrinsicElement
declare function functionalComponentArgsRest<T extends (...args: any) => any>(t: T): Parameters<T>['length'] extends 2 ? [any] : [];
export declare function pickEvent<Emit, K, E>(emit: Emit, emitKey: K, event: E): FillingEventArg<
	PickNotAny<
		AsFunctionOrAny<E>,
		AsFunctionOrAny<EmitEvent<Emit, K>>
	>
>;
export declare function pickFunctionalComponentCtx<T, K>(comp: T, compInstance: K): PickNotAny<
	K extends { __ctx?: infer Ctx } ? Ctx : any,
	T extends (props: any, ctx: infer Ctx) => any ? Ctx : any
>;
type AsFunctionOrAny<F> = unknown extends F ? any : ((...args: any) => any) extends F ? F : any;

export declare function componentProps<T, K>(comp: T, fnReturn: K):
	PickNotAny<K, {}> extends { __ctx: { props: infer P } } ? NonNullable<P>
	: T extends (props: infer P, ...args: any) => any ? NonNullable<P> :
	{};
`.trim();
}

// TODO: not working for overloads > n (n = 8)
// see: https://github.com/johnsoncodehk/volar/issues/60
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
