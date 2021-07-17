import { TextDocument } from 'vscode-languageserver-textdocument';
import * as shared from '@volar/shared';
import { join } from 'upath';

export function getGlobalDoc(root: string) {
	let code = `
import * as vue_1 from '@vue/runtime-dom';
import type { FunctionalComponent as FunctionalComponent_1 } from '@vue/runtime-dom';
import type { HTMLAttributes as HTMLAttributes_1 } from '@vue/runtime-dom';
import type { VNodeProps as VNodeProps_1 } from '@vue/runtime-dom';
import type { AllowedComponentProps as AllowedComponentProps_1 } from '@vue/runtime-dom';
import type { PropType as PropType_1 } from '@vue/runtime-dom';
import type { EmitsOptions as EmitsOptions_1 } from '@vue/runtime-dom';
import type { DefineComponent as DefineComponent_1 } from '@vue/runtime-dom';
import type { defineComponent as defineComponent_1 } from '@vue/runtime-dom';
import type { GlobalComponents as CoreGlobalComponents_1 } from '@vue/runtime-dom';
import type { SetupContext as SetupContext_1 } from '@vue/runtime-dom';

import * as vue_2 from 'vue';
import type { FunctionalComponent as FunctionalComponent_2 } from 'vue';
import type { HTMLAttributes as HTMLAttributes_2 } from 'vue';
import type { VNodeProps as VNodeProps_2 } from 'vue';
import type { AllowedComponentProps as AllowedComponentProps_2 } from 'vue';
import type { PropType as PropType_2 } from 'vue';
import type { EmitsOptions as EmitsOptions_2 } from 'vue';
import type { DefineComponent as DefineComponent_2 } from 'vue';
import type { defineComponent as defineComponent_2 } from 'vue';
import type { GlobalComponents as CoreGlobalComponents_2 } from 'vue';
import type { SetupContext as SetupContext_2 } from '@vue/runtime-dom';

import type { HTMLAttributes as HTMLAttributes_3 } from "@vue/runtime-dom/types/jsx";
import type { GlobalComponents as CoreGlobalComponents_3 } from '@vue/runtime-core';

type IsAny<T> = boolean extends (T extends never ? true : false) ? true : false;
type PickNotAny<A, B> = IsAny<A> extends true ? B : A;

type FunctionalComponent<P = {}, E extends EmitsOptions = {}> = PickNotAny<FunctionalComponent_1<P, E>, FunctionalComponent_2<P, E>>;
type HTMLAttributes = PickNotAny<PickNotAny<HTMLAttributes_1, HTMLAttributes_2>, HTMLAttributes_3>;
type VNodeProps = PickNotAny<VNodeProps_1, VNodeProps_2>;
type AllowedComponentProps = PickNotAny<AllowedComponentProps_1, AllowedComponentProps_2>;
type PropType<T> = PickNotAny<PropType_1<T>, PropType_2<T>>;
type EmitsOptions = PickNotAny<EmitsOptions_1, EmitsOptions_2>;
type DefineComponent<P, E extends EmitsOptions> = PickNotAny<DefineComponent_1<P, any, any, any, any, any, any, E>, DefineComponent_2<P, any, any, any, any, any, any, E>>;
type CoreGlobalComponents = PickNotAny<PickNotAny<PickNotAny<CoreGlobalComponents_1, CoreGlobalComponents_2>, CoreGlobalComponents_3>, {}>;
type SetupContext<T> = PickNotAny<SetupContext_1<T>, SetupContext_2<T>>;
type AnyArray<T = any> = T[] | readonly T[];
type NonUndefinedable<T> = T extends undefined ? never : T;

const throwIfAny: IsAny<HTMLAttributes> = false;

declare global {
	interface __VLS_GlobalComponents extends Pick<PickNotAny<typeof vue_1, typeof vue_2>,
		'Transition'
		| 'TransitionGroup'
		| 'KeepAlive'
		| 'Suspense'
		| 'Teleport'
	> {
		Component: <T>(props: { is: T } & __VLS_ExtractComponentProps<T extends string ? JSX.IntrinsicElements[T] : T>) => any
	}
	interface __VLS_GlobalComponents extends CoreGlobalComponents { }
	var __VLS_defineComponent: PickNotAny<typeof defineComponent_1, typeof defineComponent_2>;
	function __VLS_getVforSourceType<T>(source: T): T extends number ? number[] : T;
	function __VLS_getVforKeyType<T>(source: T): T extends AnyArray ? number : keyof T;
	function __VLS_getVforIndexType<T>(source: T): T extends AnyArray ? undefined : number;
	function __VLS_getNameOption<T>(t?: T): T extends { name: infer N } ? N : undefined;
	function __VLS_pickForItem<S, T1, T2>(source: S, forOfItem: T1, forInItem: T2): S extends { [Symbol.iterator](): infer _ } ? T1 : T2;
	function __VLS_mergePropDefaults<P, D>(props: P, defaults: D): {
		[K in keyof P]: K extends keyof D ? P[K] & {
			default: D[K]
		} : P[K]
	}
	type __VLS_ConstAttrType_Props<C> = (C extends (payload: infer P) => any ? P : {}) & Record<string, unknown>;
	type __VLS_ConstAttrType<C, K extends string> = true extends __VLS_ConstAttrType_Props<C>[K] ? true : "";
	type __VLS_FillingEventArg_ParametersLength<E extends (...args: any) => any> = IsAny<Parameters<E>> extends true ? -1 : Parameters<E>['length'];
	type __VLS_FillingEventArg<E> = E extends (...args: any) => any ? __VLS_FillingEventArg_ParametersLength<E> extends 0 ? ($event?: undefined) => ReturnType<E> : E : E;
	type __VLS_PickNotAny<A, B> = PickNotAny<A, B>;
	type __VLS_ExtractComponentProps<C> = C extends new (...args: any) => { $props: infer P1 } ? P1 : C extends FunctionalComponent<infer P2> ? P2 : C extends { props: infer P3 } ? P3 : C;
	type __VLS_ExtractRawComponents<T> = { [K in keyof T]: __VLS_ExtractRawComponent<T[K]> };
	type __VLS_ExtractRawComponent<T> = T extends { __VLS_raw: infer C } ? C : T;
	type __VLS_MapPropsTypeBase<T> = { [K in keyof T]: __VLS_ExtractComponentProps<T[K]> };
	type __VLS_MapPropsType<T> = { [K in keyof T]:
		T[K] extends FunctionalComponent<infer A> ? (props: A & JSX.IntrinsicAttributes & Record<string, unknown>) => any
		: (props: __VLS_ExtractComponentProps<T[K]> & Omit<__VLS_GlobalAttrs, keyof __VLS_ExtractComponentProps<T[K]>> & Record<string, unknown>) => any
	};
	type __VLS_MapEmitType<T> = { [K in keyof T]: __VLS_ExtractEmit2<T[K]> };
	type __VLS_ExtractEmit2<T> =
		T extends FunctionalComponent<infer _, infer E> ? SetupContext<E>['emit']
		: T extends new (...args: any) => { $emit: infer Emit } ? Emit
		: unknown;
	type __VLS_ReturnVoid<T> = T extends (...payload: infer P) => any ? (...payload: P) => void : (...args: any) => void;
	type __VLS_UnknownToAny<T> = T extends unknown ? any : T;
	type __VLS_EmitEvent2<F, E> =
		F extends {
			(event: E, ...payload: infer P): infer R
			(...args: any): any
			(...args: any): any
			(...args: any): any
		} ? (...payload: __VLS_UnknownToAny<P>) => __VLS_UnknownToAny<R>
		: F extends {
			(event: E, ...payload: infer P): infer R
			(...args: any): any
			(...args: any): any
		} ? (...payload: __VLS_UnknownToAny<P>) => __VLS_UnknownToAny<R>
		: F extends {
			(event: E, ...payload: infer P): infer R
			(...args: any): any
		} ? (...payload: __VLS_UnknownToAny<P>) => __VLS_UnknownToAny<R>
		: F extends {
			(event: E, ...payload: infer P): infer R
		} ? (...payload: __VLS_UnknownToAny<P>) => __VLS_UnknownToAny<R>
		: unknown | '[Type Warning] Volar cloud not infer $emit event more than 4 overloads without DefineComponent. see https://github.com/johnsoncodehk/volar/issues/60';
	type __VLS_EmitEvent<T, E> =
		T extends DefineComponent<infer _, infer E2> ? __VLS_EmitEvent_3<E2, E>
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
	type __VLS_PickComponents<T> = { [K in keyof T as T[K] extends (new (...args: any) => any) | FunctionalComponent<infer _> ? K : never]:
		T[K] extends never ? any : T[K] // fix https://github.com/johnsoncodehk/vue-tsc/issues/21
	};
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
