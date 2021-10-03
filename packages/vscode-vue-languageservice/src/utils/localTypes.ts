const camelCaseText = [
	'type CamelCase<S extends string> = S extends `${infer First}-${infer Right}`',
	'? Capitalize<Right> extends Right',
	'? `${First}-${CamelCase<Capitalize<Right>>}`',
	': `${First}${CamelCase<Capitalize<Right>>}`',
	': S',
].join('\n');

export const code = `
import type * as vue_1 from '@vue/runtime-dom';
import type * as vue_2 from 'vue';
import type * as vue_3 from '@vue/runtime-core';

type IsAny<T> = boolean extends (T extends never ? true : false) ? true : false;
type IsFunctionalComponent<T> = T extends FunctionalComponent<infer _> ? true : false;
type IsConstructorComponent<T> = T extends new (...args: any) => any ? true : false;
type IsComponent<T> = IsConstructorComponent<T> extends true ? true : IsFunctionalComponent<T> extends true ? true : false;
type ComponentKeys<T> = keyof { [K in keyof T as IsComponent<T[K]> extends true ? K : never]: any };
export type PickNotAny<A, B> = IsAny<A> extends true ? B : A;
type AnyArray<T = any> = T[] | readonly T[];
type NonUndefinedable<T> = T extends undefined ? never : T;
${camelCaseText};

type FunctionalComponent<P = {}, E extends EmitsOptions = {}> = PickNotAny<vue_1.FunctionalComponent<P, E>, vue_2.FunctionalComponent<P, E>>;
type HTMLAttributes = PickNotAny<vue_1.HTMLAttributes, vue_2.HTMLAttributes>;
type VNodeProps = PickNotAny<vue_1.VNodeProps, vue_2.VNodeProps>;
type AllowedComponentProps = PickNotAny<vue_1.AllowedComponentProps, vue_2.AllowedComponentProps>;
type PropType<T> = PickNotAny<vue_1.PropType<T>, vue_2.PropType<T>>;
type EmitsOptions = PickNotAny<vue_1.EmitsOptions, vue_2.EmitsOptions>;
type DefineComponent_1<P, E extends EmitsOptions> = PickNotAny<vue_1.DefineComponent<P, any, any, any, any, any, any, E>, vue_2.DefineComponent<P, any, any, any, any, any, any, E>>;
type DefineComponent_2<P, E extends EmitsOptions> = DefineComponent_1<P, E>; // fix check extends failed if have no defineProps
type DefineComponent_3<P, E extends EmitsOptions> = PickNotAny<vue_1.DefineComponent<P, any, any, any, any, any, any, E, any, any, any, any>, vue_2.DefineComponent<P, any, any, any, any, any, any, E, any, any, any, any>>; // fix https://github.com/johnsoncodehk/volar/issues/495
type DefineComponent_4<P, E extends EmitsOptions> = DefineComponent_3<P, E>;
type GlobalComponents_0 = PickNotAny<PickNotAny<PickNotAny<vue_1.GlobalComponents, vue_2.GlobalComponents>, vue_3.GlobalComponents>, {}>;
type SetupContext<T> = PickNotAny<vue_1.SetupContext<T>, vue_2.SetupContext<T>>;
type ObjectDirective<T, V> = PickNotAny<vue_1.ObjectDirective<T, V>, vue_2.ObjectDirective<T, V>>;
type FunctionDirective<T, V> = PickNotAny<vue_1.FunctionDirective<T, V>, vue_2.FunctionDirective<T, V>>;

export type GlobalComponents = GlobalComponents_0 & Pick<PickNotAny<typeof vue_1, typeof vue_2>,
	'Transition'
	| 'TransitionGroup'
	| 'KeepAlive'
	| 'Suspense'
	| 'Teleport'
>;

export var defineComponent: PickNotAny<typeof vue_1.defineComponent, typeof vue_2.defineComponent>;
export declare function getVforSourceType<T>(source: T): T extends number ? number[] : T;
export declare function getVforKeyType<T>(source: T): typeof Symbol.iterator extends keyof T ? number : T extends T ? keyof T : never; // use "T extends T" support for union
export declare function getVforIndexType<T>(source: T): typeof Symbol.iterator extends keyof T ? undefined : number;
export declare function getNameOption<T>(t?: T): T extends { name: infer N } ? N : undefined;
export declare function pickForItem<T>(source: T): T extends { [Symbol.iterator](): IterableIterator<infer T1> } ? T1 : T[keyof T];
export declare function mergePropDefaults<P, D>(props: P, defaults: D): {
	[K in keyof P]: K extends keyof D ? P[K] & {
		default: D[K]
	} : P[K]
}
export declare function directiveFunction<T>(dir: T): T extends ObjectDirective<infer E, infer V> ? V extends { value: infer V_2 } ? (value: V_2) => void : (value: V) => void
	: T extends FunctionDirective<infer E, infer V> ? V extends { value: infer V_2 } ? (value: V_2) => void : (value: V) => void : T;

export type TemplateSlots<T> = T extends { slots: infer S } ? S : {};
export type HasTemplateSlotsType<T> = T extends { slots: infer _ } ? true : false;
export type HasScriptSlotsType<T> = T extends new (...args: any) => { $slots?: infer _ } ? true : false;
export type DefaultSlots<W, R> = HasTemplateSlotsType<W> extends true ? {}
	: HasScriptSlotsType<R> extends true ? {}
	: Record<string, any>;
export type SlotsComponent<T> = T extends new (...args: any) => { $slots?: infer S } ? T : new (...args: any) => { $slots: {} };
export type ScriptSlots<T> = T extends { $slots?: infer S }
	? { [K in keyof S]-?: S[K] extends ((obj: infer O) => any) | undefined ? O : S[K] }
	: {};

export type GetComponentName<T, K extends string> = K extends keyof T ? IsAny<T[K]> extends false ? K : GetComponentName_CamelCase<T, CamelCase<K>> : GetComponentName_CamelCase<T, CamelCase<K>>;
export type GetComponentName_CamelCase<T, K extends string> = K extends keyof T ? IsAny<T[K]> extends false ? K : GetComponentName_CapitalCase<T, Capitalize<K>> : GetComponentName_CapitalCase<T, Capitalize<K>>;
export type GetComponentName_CapitalCase<T, K> = K extends keyof T ? K : never;

export type FillingEventArg_ParametersLength<E extends (...args: any) => any> = IsAny<Parameters<E>> extends true ? -1 : Parameters<E>['length'];
export type FillingEventArg<E> = E extends (...args: any) => any ? FillingEventArg_ParametersLength<E> extends 0 ? ($event?: undefined) => ReturnType<E> : E : E;
export type GetProperty<T, K, N = any> = K extends keyof T ? T[K] : N;
export type ComponentContext<T> = T extends new (...args: any) => any ? InstanceType<T> : T extends (...args: any) => any ? ReturnType<T> : T;
export type OptionsSetupReturns<T> = T extends { setup(): infer R } ? R : {};
export type OptionsProps<T> = T extends { props: infer R } ? R : {};
export type SelectComponent<T1, T2> = T1 extends (new (...args: any) => any) ? T1 : T1 extends ((...args: any) => any) ? T1 : T2;

export type ExtractComponentProps<T> =
	T extends new (...args: any) => { $props?: infer P1 } ? P1
	: T extends FunctionalComponent<infer P2> ? P2
	: T
export type ExtractCompleteComponentProps<T> =
	T extends new (...args: any) => { $props?: infer P1 } ? P1 & Omit<GlobalAttrs, keyof P1> & Record<string, unknown>
	: T extends FunctionalComponent<infer P2> ? P2 & JSX.IntrinsicAttributes & Record<string, unknown>
	: T & Omit<GlobalAttrs, keyof T> & Record<string, unknown>

export type ExtractRawComponents<T> = { [K in keyof T]: ExtractRawComponent<T[K]> };
export type ExtractRawComponent<T> = T extends { raw: infer C } ? C : T;
export type ExtractEmit2<T> =
	T extends FunctionalComponent<infer _, infer E> ? SetupContext<E>['emit']
	: T extends new (...args: any) => { $emit: infer Emit } ? Emit
	: unknown;
export type ReturnVoid<T> = T extends (...payload: infer P) => any ? (...payload: P) => void : (...args: any) => void;
export type EmitEvent2<F, E> =
	F extends {
		(event: E, ...payload: infer P): infer R
		(...args: any): any
		(...args: any): any
		(...args: any): any
	} ? (...payload: P) => R
	: F extends {
		(event: E, ...payload: infer P): infer R
		(...args: any): any
		(...args: any): any
	} ? (...payload: P) => R
	: F extends {
		(event: E, ...payload: infer P): infer R
		(...args: any): any
	} ? (...payload: P) => R
	: F extends {
		(event: E, ...payload: infer P): infer R
	} ? (...payload: P) => R
	: unknown | '[Type Warning] Volar cloud not infer $emit event more than 4 overloads without DefineComponent. see https://github.com/johnsoncodehk/volar/issues/60';
export type EmitEvent<T, E> =
	T extends DefineComponent_1<infer _, infer E2> ? EmitEvent_3<E2, E>
	: T extends DefineComponent_2<infer _, infer E2> ? EmitEvent_3<E2, E>
	: T extends DefineComponent_3<infer _, infer E2> ? EmitEvent_3<E2, E>
	: T extends DefineComponent_4<infer _, infer E2> ? EmitEvent_3<E2, E>
	: T extends FunctionalComponent<infer _, infer E2> ? EmitEvent_3<E2, E>
	: EmitEvent2<ExtractEmit2<T>, E>;
export type EmitEvent_3<E2, E> =
	EmitsOptions extends E2 ? unknown
	: E2 extends AnyArray<infer K> ? (E extends K ? (...args: any) => void : unknown) // emits: ['event-1', 'event-2']
	: E extends keyof E2 ? ReturnVoid<E2[E]> // emits: { 'event-1': () => true, 'event-2': () => true }
	: unknown
export type FirstFunction<F0, F1> =
	NonNullable<F0> extends (Function | AnyArray<Function>) ? F0 :
	NonNullable<F1> extends (Function | AnyArray<Function>) ? F1 : unknown;
export type GlobalAttrsBase = VNodeProps & AllowedComponentProps;
export type GlobalAttrs = GlobalAttrsBase & HTMLAttributes;
export type DefinePropsToOptions<T> = { [K in keyof T]-?: {} extends Pick<T, K> ? { type: PropType<NonUndefinedable<T[K]>> } : { type: PropType<T[K]>, required: true } };
export type PickComponents<T> = ComponentKeys<T> extends keyof T ? Pick<T, ComponentKeys<T>> : T;
export type SelfComponent<N, C> = string extends N ? {} : N extends string ? { [P in N]: C } : {};

export ${genConstructorOverloads()}
`;

// TODO: not working for overloads > n (n = 8)
// see: https://github.com/johnsoncodehk/volar/issues/60
function genConstructorOverloads() {
	let code = `type ConstructorOverloads<T> =\n`;
	for (let i = 8; i >= 1; i--) {
		code += `// ${i}\n`;
		code += `T extends {\n`;
		for (let j = 1; j <= i; j++) {
			code += `(event: infer E${j}, ...payload: infer P${j}): void;\n`
		}
		code += `} ? (\n`
		for (let j = 1; j <= i; j++) {
			if (j > 1) code += '& ';
			code += `(E${j} extends string ? { [K${j} in E${j}]: (...payload: P${j}) => void } : {})\n`;
		}
		code += `) :\n`;
	}
	code += `// 0\n`
	code += `unknown;\n`
	return code;
}
