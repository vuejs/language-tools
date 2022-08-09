import { getSlotsPropertyName, getVueLibraryName } from './shared';

export const typesFileName = '__VLS_types.ts';

export function getTypesCode(vueVersion: number) {
	const libName = getVueLibraryName(vueVersion);
	const slots = getSlotsPropertyName(vueVersion);
	return `
import * as vue from '${libName}';
import type {
	FunctionalComponent,
	EmitsOptions,
	DefineComponent,
	SetupContext,
	ObjectDirective,
	FunctionDirective,
} from '${libName}';

type IsAny<T> = boolean extends (T extends never ? true : false) ? true : false;
export type PickNotAny<A, B> = IsAny<A> extends true ? B : A;
type AnyArray<T = any> = T[] | readonly T[];
type ForableSource<T> = [
	T extends { [Symbol.iterator](): IterableIterator<infer T1> } ? T1 : T[keyof T], // item
	typeof Symbol.iterator extends keyof T ? number : T extends T ? keyof T : never, // key
	typeof Symbol.iterator extends keyof T ? undefined : number, // index
][];

export type GlobalComponents =
	// @ts-ignore
	PickNotAny<import('vue').GlobalComponents, {}>
	// @ts-ignore
	& PickNotAny<import('@vue/runtime-core').GlobalComponents, {}>
	// @ts-ignore
	& PickNotAny<import('@vue/runtime-dom').GlobalComponents, {}>
	& Pick<typeof vue,
		// @ts-ignore
		'Transition'
		| 'TransitionGroup'
		| 'KeepAlive'
		| 'Suspense'
		| 'Teleport'
	>;

export declare function getVforSourceType<T>(source: T): ForableSource<NonNullable<T extends number ? number[] : T extends string ? string[] : T>>;
export declare function getNameOption<T>(t?: T): T extends { name: infer N } ? N : undefined;
export declare function directiveFunction<T>(dir: T):
	T extends ObjectDirective<infer E, infer V> ? undefined extends V ? (value?: V) => void : (value: V) => void
	: T extends FunctionDirective<infer E, infer V> ? undefined extends V ? (value?: V) => void : (value: V) => void
	: T;
export declare function withScope<T, K>(ctx: T, scope: K): ctx is T & K;
export declare function makeOptional<T>(t: T): { [K in keyof T]?: T[K] };

export type ExtractComponentSlots<T> =
	IsAny<T> extends true ? Record<string, any>
	: T extends { ${slots}?: infer S } ? { [K in keyof S]-?: S[K] extends ((obj: infer O) => any) | undefined ? O : any }
	: Record<string, any>;

export type FillingEventArg_ParametersLength<E extends (...args: any) => any> = IsAny<Parameters<E>> extends true ? -1 : Parameters<E>['length'];
export type FillingEventArg<E> = E extends (...args: any) => any ? FillingEventArg_ParametersLength<E> extends 0 ? ($event?: undefined) => ReturnType<E> : E : E;

export type ExtractEmit2<T> =
	T extends FunctionalComponent<infer _, infer E> ? SetupContext<E>['emit']
	: T extends new (...args: any) => { $emit: infer Emit } ? Emit
	: unknown;
export type ReturnVoid<T> = T extends (...payload: infer P) => any ? (...payload: P) => void : (...args: any) => void;
export type EmitEvent2<F, E> =
	F extends {
		(event: E, ...payload: infer P): infer R
	} ? (...payload: P) => void
	: F extends {
		(event: E, ...payload: infer P): infer R
		(...args: any): any
	} ? (...payload: P) => void
	: F extends {
		(event: E, ...payload: infer P): infer R
		(...args: any): any
		(...args: any): any
	} ? (...payload: P) => void
	: F extends {
		(event: E, ...payload: infer P): infer R
		(...args: any): any
		(...args: any): any
		(...args: any): any
	} ? (...payload: P) => void
	: unknown | '[Type Warning] Volar could not infer $emit event more than 4 overloads without DefineComponent. see https://github.com/johnsoncodehk/volar/issues/60';
export type EmitEvent<T, E> =
	T extends DefineComponent<infer _, any, any, any, any, any, any, infer E2> ? EmitEvent_3<E2, E>
	: T extends FunctionalComponent<infer _, infer E2> ? EmitEvent_3<E2, E>
	: T extends FunctionalComponent<infer _, infer E> ? EmitEvent2<SetupContext<E>['emit'], E>
	: unknown;
export type EmitEvent_3<E2, E> =
	EmitsOptions extends E2 ? unknown
	: E2 extends AnyArray<infer K> ? (E extends K ? (...args: any) => void : unknown) // emits: ['event-1', 'event-2']
	: E extends keyof E2 ? ReturnVoid<E2[E]> // emits: { 'event-1': () => true, 'event-2': () => true }
	: unknown
export type FirstFunction<F0 = void, F1 = void, F2 = void, F3 = void, F4 = void> =
	NonNullable<F0> extends (Function | AnyArray<Function>) ? F0 :
	NonNullable<F1> extends (Function | AnyArray<Function>) ? F1 :
	NonNullable<F2> extends (Function | AnyArray<Function>) ? F2 :
	NonNullable<F3> extends (Function | AnyArray<Function>) ? F3 :
	NonNullable<F4> extends (Function | AnyArray<Function>) ? F4 :
	unknown;
export type GlobalAttrs = JSX.IntrinsicElements['div'];
export type SelfComponent<N, C> = string extends N ? {} : N extends string ? { [P in N]: C } : {};
export type PickComponents<T> = ComponentKeys<T> extends keyof T ? Pick<T, ComponentKeys<T>> : T;
export type ConvertInvalidJsxElement<T> = IsComponent<T> extends true ? T : any;

type IsComponent<T> =
	T extends (...args: any) => JSX.Element ? true
	: T extends new (...args: any) => JSX.ElementClass ? true
	: IsAny<T>
type ComponentKeys<T> = keyof { [K in keyof T as IsComponent<T[K]> extends true ? K : never]: any };
`;
}

// TODO: not working for overloads > n (n = 8)
// see: https://github.com/johnsoncodehk/volar/issues/60
export function genConstructorOverloads(name = 'ConstructorOverloads', nums?: number) {
	let code = `type ${name}<T> =\n`;
	if (nums === undefined) {
		for (let i = 8; i >= 1; i--) {
			gen(i);
		}
	}
	else {
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
