import { TextDocument } from 'vscode-languageserver-textdocument';
import * as shared from '@volar/shared';
import { join } from 'upath';

const camelCaseText = [
	'type CamelCase<S extends string> = S extends `${infer First}-${infer Right}`',
	'? Capitalize<Right> extends Right',
	'? `${First}-${CamelCase<Capitalize<Right>>}`',
	': `${First}${CamelCase<Capitalize<Right>>}`',
	': S',
].join('\n');

export function createGlobalDefineDocument(root: string) {
	let code = `
import type * as vue_1 from '@vue/runtime-dom';
import type * as vue_2 from 'vue';
import type * as vue_3 from '@vue/runtime-core';
import type * as vue_4 from '@vue/runtime-dom/types/jsx';

type IsAny<T> = boolean extends (T extends never ? true : false) ? true : false;
type IsComponent<T> = T extends (new (...args: any) => any) | FunctionalComponent<infer _> ? true : false;
type ComponentKeys<T> = keyof { [K in keyof T as IsComponent<T[K]> extends false ? never : K]: any };
type PickNotAny<A, B> = IsAny<A> extends true ? B : A;
type AnyArray<T = any> = T[] | readonly T[];
type NonUndefinedable<T> = T extends undefined ? never : T;
${camelCaseText};

type FunctionalComponent<P = {}, E extends EmitsOptions = {}> = PickNotAny<vue_1.FunctionalComponent<P, E>, vue_2.FunctionalComponent<P, E>>;
type HTMLAttributes = PickNotAny<PickNotAny<vue_1.HTMLAttributes, vue_2.HTMLAttributes>, vue_4.HTMLAttributes>;
type VNodeProps = PickNotAny<vue_1.VNodeProps, vue_2.VNodeProps>;
type AllowedComponentProps = PickNotAny<vue_1.AllowedComponentProps, vue_2.AllowedComponentProps>;
type PropType<T> = PickNotAny<vue_1.PropType<T>, vue_2.PropType<T>>;
type EmitsOptions = PickNotAny<vue_1.EmitsOptions, vue_2.EmitsOptions>;
type DefineComponent_1<P, E extends EmitsOptions> = PickNotAny<vue_1.DefineComponent<P, any, any, any, any, any, any, E>, vue_2.DefineComponent<P, any, any, any, any, any, any, E>>;
type DefineComponent_2<P, E extends EmitsOptions> = DefineComponent_1<P, E>; // fix check extends failed if have no defineProps
type DefineComponent_3<P, E extends EmitsOptions> = PickNotAny<vue_1.DefineComponent<P, any, any, any, any, any, any, E, any, any, any, any>, vue_2.DefineComponent<P, any, any, any, any, any, any, E, any, any, any, any>>; // fix https://github.com/johnsoncodehk/volar/issues/495
type DefineComponent_4<P, E extends EmitsOptions> = DefineComponent_3<P, E>;
type GlobalComponents = PickNotAny<PickNotAny<PickNotAny<vue_1.GlobalComponents, vue_2.GlobalComponents>, vue_3.GlobalComponents>, {}>;
type SetupContext<T> = PickNotAny<vue_1.SetupContext<T>, vue_2.SetupContext<T>>;
type ObjectDirective<T, V> = PickNotAny<vue_1.ObjectDirective<T, V>, vue_2.ObjectDirective<T, V>>;
type FunctionDirective<T, V> = PickNotAny<vue_1.FunctionDirective<T, V>, vue_2.FunctionDirective<T, V>>;

const throwIfAny: IsAny<HTMLAttributes> = false;

declare global {
	interface __VLS_GlobalComponents extends Pick<PickNotAny<typeof vue_1, typeof vue_2>,
		'Transition'
		| 'TransitionGroup'
		| 'KeepAlive'
		| 'Suspense'
		| 'Teleport'
	> { }
	interface __VLS_GlobalComponents extends GlobalComponents { }
	var __VLS_defineComponent: PickNotAny<typeof vue_1.defineComponent, typeof vue_2.defineComponent>;
	function __VLS_getVforSourceType<T>(source: T): T extends number ? number[] : T;
	function __VLS_getVforKeyType<T>(source: T): T extends AnyArray ? number : keyof T;
	function __VLS_getVforIndexType<T>(source: T): T extends AnyArray ? undefined : number;
	function __VLS_getNameOption<T>(t?: T): T extends { name: infer N } ? N : undefined;
	function __VLS_pickForItem<S, T2>(source: S, forInItem: T2): S extends { [Symbol.iterator](): IterableIterator<infer T1> } ? T1 : T2;
	function __VLS_mergePropDefaults<P, D>(props: P, defaults: D): {
		[K in keyof P]: K extends keyof D ? P[K] & {
			default: D[K]
		} : P[K]
	}
	function __VLS_directiveFunction<T>(dir: T): T extends ObjectDirective<infer E, infer V> ? V extends { value: infer V_2 } ? (value: V_2) => void : (value: V) => void
		: T extends FunctionDirective<infer E, infer V> ? V extends { value: infer V_2 } ? (value: V_2) => void : (value: V) => void : T;

	function __VLS_getTemplateSlots<T>(t: T): T extends { __VLS_slots: infer S } ? S : {};
	function __VLS_getScriptSlots<T>(t: T): T extends new (...args: any) => { $slots?: infer S } ? (S extends object ? S : {}) : {};

	type __VLS_GetComponentName<T, K extends string> = K extends keyof T ? IsAny<T[K]> extends false ? K : __VLS_GetComponentName_CamelCase<T, CamelCase<K>> : __VLS_GetComponentName_CamelCase<T, CamelCase<K>>;
	type __VLS_GetComponentName_CamelCase<T, K extends string> = K extends keyof T ? IsAny<T[K]> extends false ? K : __VLS_GetComponentName_CapitalCase<T, Capitalize<K>> : __VLS_GetComponentName_CapitalCase<T, Capitalize<K>>;
	type __VLS_GetComponentName_CapitalCase<T, K> = K extends keyof T ? K : never;

	type __VLS_ConstAttrType_Props<C> = (C extends (payload: infer P) => any ? P : {}) & Record<string, unknown>;
	type __VLS_ConstAttrType<C, K extends string> = true extends __VLS_ConstAttrType_Props<C>[K] ? true : "";
	type __VLS_FillingEventArg_ParametersLength<E extends (...args: any) => any> = IsAny<Parameters<E>> extends true ? -1 : Parameters<E>['length'];
	type __VLS_FillingEventArg<E> = E extends (...args: any) => any ? __VLS_FillingEventArg_ParametersLength<E> extends 0 ? ($event?: undefined) => ReturnType<E> : E : E;
	type __VLS_PickNotAny<A, B> = PickNotAny<A, B>;
	type __VLS_GetProperty<T, K, N = any> = K extends keyof T ? T[K] : N;
	type __VLS_ComponentContext<T> = T extends new (...args: any) => any ? InstanceType<T> : T extends (...args: any) => any ? ReturnType<T> : T;
	type __VLS_OptionsSetupReturns<T> = T extends { setup(): infer R } ? R : {};
	type __VLS_OptionsProps<T> = T extends { props: infer R } ? R : {};
	type __VLS_SelectComponent<T1, T2> = T1 extends (new (...args: any) => any) ? T1 : T1 extends ((...args: any) => any) ? T1 : T2;

	type __VLS_ExtractComponentProps<T> =
		T extends new (...args: any) => { $props?: infer P1 } ? P1
		: T extends FunctionalComponent<infer P2> ? P2
		: T
	type __VLS_ExtractCompleteComponentProps<T> =
		T extends new (...args: any) => { $props?: infer P1 } ? P1 & Omit<__VLS_GlobalAttrs, keyof P1> & Record<string, unknown>
		: T extends FunctionalComponent<infer P2> ? P2 & JSX.IntrinsicAttributes & Record<string, unknown>
		: T & Omit<__VLS_GlobalAttrs, keyof T> & Record<string, unknown>

	type __VLS_ExtractRawComponents<T> = { [K in keyof T]: __VLS_ExtractRawComponent<T[K]> };
	type __VLS_ExtractRawComponent<T> = T extends { __VLS_raw: infer C } ? C : T;
	type __VLS_ExtractEmit2<T> =
		T extends FunctionalComponent<infer _, infer E> ? SetupContext<E>['emit']
		: T extends new (...args: any) => { $emit: infer Emit } ? Emit
		: unknown;
	type __VLS_ReturnVoid<T> = T extends (...payload: infer P) => any ? (...payload: P) => void : (...args: any) => void;
	type __VLS_EmitEvent2<F, E> =
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
	type __VLS_EmitEvent<T, E> =
		T extends DefineComponent_1<infer _, infer E2> ? __VLS_EmitEvent_3<E2, E>
		: T extends DefineComponent_2<infer _, infer E2> ? __VLS_EmitEvent_3<E2, E>
		: T extends DefineComponent_3<infer _, infer E2> ? __VLS_EmitEvent_3<E2, E>
		: T extends DefineComponent_4<infer _, infer E2> ? __VLS_EmitEvent_3<E2, E>
		: T extends FunctionalComponent<infer _, infer E2> ? __VLS_EmitEvent_3<E2, E>
		: __VLS_EmitEvent2<__VLS_ExtractEmit2<T>, E>;
	type __VLS_EmitEvent_3<E2, E> =
		EmitsOptions extends E2 ? unknown
		: E2 extends AnyArray<infer K> ? (E extends K ? (...args: any) => void : unknown) // emits: ['event-1', 'event-2']
		: E extends keyof E2 ? __VLS_ReturnVoid<E2[E]> // emits: { 'event-1': () => true, 'event-2': () => true }
		: unknown
	type __VLS_FirstFunction<F0, F1> =
		NonNullable<F0> extends (Function | AnyArray<Function>) ? F0 :
		NonNullable<F1> extends (Function | AnyArray<Function>) ? F1 : unknown;
	type __VLS_GlobalAttrsBase = VNodeProps & AllowedComponentProps;
	type __VLS_GlobalAttrs = __VLS_GlobalAttrsBase & HTMLAttributes;
	type __VLS_DefinePropsToOptions<T> = { [K in keyof T]-?: {} extends Pick<T, K> ? { type: PropType<NonUndefinedable<T[K]>> } : { type: PropType<T[K]>, required: true } };
	type __VLS_PickComponents<T> = ComponentKeys<T> extends keyof T ? Pick<T, ComponentKeys<T>> : T;
	type __VLS_SelfComponent<N, C> = string extends N ? {} : N extends string ? { [P in N]: C } : {};

	${genConstructorOverloads()}
}
`;

	return TextDocument.create(shared.fsPathToUri(join(root, '__VLS_globals.ts')), 'typescript', 0, code);
}

// TODO: not working for overloads > n (n = 8)
// see: https://github.com/johnsoncodehk/volar/issues/60
function genConstructorOverloads() {
	let code = `type __VLS_ConstructorOverloads<T> =\n`;
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
