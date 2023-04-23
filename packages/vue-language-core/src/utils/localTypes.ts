import { VueCompilerOptions } from '../types';
import { getVueLibraryName } from './shared';

export const typesFileName = '__VLS_types.d.ts';

export function getTypesCode(
	vueVersion: number,
	vueCompilerOptions: VueCompilerOptions,
) {
	const libName = getVueLibraryName(vueVersion);
	return `
// @ts-nocheck
import type {
	ObjectDirective,
	FunctionDirective,
} from '${libName}';

export type IntrinsicElements = PickNotAny<import('vue/jsx-runtime').JSX, PickNotAny<JSX.IntrinsicElements, Record<string, any>>>;
export type Element = PickNotAny<import('vue/jsx-runtime').JSX, JSX.Element>;

type IsAny<T> = boolean extends (T extends never ? true : false) ? true : false;
export type PickNotAny<A, B> = IsAny<A> extends true ? B : A;
type ForableSource<T> = [
	T extends { [Symbol.iterator](): Iterator<infer T1> } ? T1 : T[keyof T], // item
	typeof Symbol.iterator extends keyof T ? number : T extends T ? keyof T : never, // key
	typeof Symbol.iterator extends keyof T ? undefined : number, // index
][];

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
	& Pick<typeof import('${libName}'),
		// @ts-ignore
		'Transition'
		| 'TransitionGroup'
		| 'KeepAlive'
		| 'Suspense'
		| 'Teleport'
	>;

export declare function getVForSourceType<T>(source: T): ForableSource<NonNullable<T extends number ? number[] : T extends string ? string[] : T>>;
export declare function getSlotParams<T>(slot: T): Parameters<PickNotAny<NonNullable<T>, (...args: any[]) => any>>;
export declare function getSlotParam<T>(slot: T): Parameters<PickNotAny<NonNullable<T>, (...args: any[]) => any>>[0];
export declare function directiveFunction<T>(dir: T):
	T extends ObjectDirective<infer E, infer V> ? undefined extends V ? (value?: V) => void : (value: V) => void
	: T extends FunctionDirective<infer E, infer V> ? undefined extends V ? (value?: V) => void : (value: V) => void
	: T;
export declare function withScope<T, K>(ctx: T, scope: K): ctx is T & K;
export declare function makeOptional<T>(t: T): { [K in keyof T]?: T[K] };

export type SelfComponent<N, C> = string extends N ? {} : N extends string ? { [P in N]: C } : {};
export type WithComponent<Components, N1 extends string, N2 extends string, N0 extends string> =
	IsAny<IntrinsicElements[N0]> extends true ? (
		N1 extends keyof Components ? N1 extends N0 ? Pick<Components, N0> : { [K in N0]: Components[N1] } :
		N2 extends keyof Components ? N2 extends N0 ? Pick<Components, N0> : { [K in N0]: Components[N2] } :
		N0 extends keyof Components ? Pick<Components, N0> :
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
	T extends new (...args: any) => any ?
		K extends { $props?: infer Props, $slots?: infer Slots, $emit?: infer Emit }
			? (props: Props ${vueCompilerOptions.strictTemplates ? '' : '& Record<string, unknown>'}, ctx?: { attrs?: any, expose?(exposed: K): void, slots?: Slots, emit?: Emit }) => JSX.Element & { __ctx?: typeof ctx, __props?: typeof props }
			: never
	: T extends () => any ? (props: {}, ctx?: any) => ReturnType<T>
	: T extends (...args: any) => any ? T
	: (_: T & Record<string, unknown>, ctx?: any) => { __ctx?: { attrs?: unknown, expose?: unknown, slots?: unknown, emit?: unknown }, __props?: T & Record<string, unknown> }; // IntrinsicElement
declare function functionalComponentArgsRest<T extends (...args: any) => any>(t: T): Parameters<T>['length'] extends 2 ? [any] : [];
export declare function pickEvent<Emit, K, E>(emit: Emit, emitKey: K, event: E): FillingEventArg<
	PickNotAny<
		AsFunctionOrAny<NonNullable<E>>,
		AsFunctionOrAny<NonNullable<EmitEvent<Emit, K>>>
	>
>;
export declare function pickFunctionalComponentCtx<T, K>(comp: T, compInstance: K): PickNotAny<
	K extends { __ctx?: infer Ctx } ? Ctx : any,
	T extends (props: any, ctx: infer Ctx) => any ? Ctx : any
>;
type AsFunctionOrAny<F> = F extends ((...args: any) => any) ? F : any;
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
