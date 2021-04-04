import { TextDocument } from 'vscode-languageserver-textdocument';
import { SearchTexts } from '../utils/string';
import { fsPathToUri } from '@volar/shared';
import { join } from 'upath';

export function getGlobalDoc(root: string) {
	let code = `
import * as vue_1 from '@vue/runtime-dom';
import type { FunctionalComponent as FunctionalComponent_1 } from '@vue/runtime-dom';
import type { HTMLAttributes as HTMLAttributes_1 } from '@vue/runtime-dom';
import type { VNodeProps as VNodeProps_1 } from '@vue/runtime-dom';
import type { AllowedComponentProps as AllowedComponentProps_1 } from '@vue/runtime-dom';
import type { PropType as PropType_1 } from '@vue/runtime-dom';
import type { App as App_1 } from '@vue/runtime-dom';
import type { EmitsOptions as EmitsOptions_1 } from '@vue/runtime-dom';
import type { DefineComponent as DefineComponent_1 } from '@vue/runtime-dom';
import type { defineComponent as defineComponent_1 } from '@vue/runtime-dom';

import * as vue_2 from 'vue';
import type { FunctionalComponent as FunctionalComponent_2 } from 'vue';
import type { HTMLAttributes as HTMLAttributes_2 } from 'vue';
import type { VNodeProps as VNodeProps_2 } from 'vue';
import type { AllowedComponentProps as AllowedComponentProps_2 } from 'vue';
import type { PropType as PropType_2 } from 'vue';
import type { App as App_2 } from 'vue';
import type { EmitsOptions as EmitsOptions_2 } from 'vue';
import type { DefineComponent as DefineComponent_2 } from 'vue';
import type { defineComponent as defineComponent_2 } from 'vue';

import type { HTMLAttributes as HTMLAttributes_3 } from "@vue/runtime-dom/types/jsx";

type IsAny<T> = boolean extends (T extends never ? true : false) ? true : false;
type PickNotAny<A, B> = IsAny<A> extends true ? B : A;

type FunctionalComponent<T> = PickNotAny<FunctionalComponent_1<T>, FunctionalComponent_2<T>>;
type HTMLAttributes = PickNotAny<PickNotAny<HTMLAttributes_1, HTMLAttributes_2>, HTMLAttributes_3>;
type VNodeProps = PickNotAny<VNodeProps_1, VNodeProps_2>;
type AllowedComponentProps = PickNotAny<AllowedComponentProps_1, AllowedComponentProps_2>;
type PropType<T> = PickNotAny<PropType_1<T>, PropType_2<T>>;
type App = PickNotAny<App_1, App_2>;
type EmitsOptions = PickNotAny<EmitsOptions_1, EmitsOptions_2>;
type DefineComponent<P, E extends EmitsOptions> = PickNotAny<DefineComponent_1<P, any, any, any, any, any, any, E>, DefineComponent_2<P, any, any, any, any, any, any, E>>;

const throwIfAny: IsAny<HTMLAttributes> = false;

declare module '@vue/runtime-core' {
	export interface GlobalComponents { }
}

declare global {
	interface __VLS_GlobalComponents extends Pick<PickNotAny<typeof vue_1, typeof vue_2>,
		'Transition'
		| 'TransitionGroup'
		| 'KeepAlive'
		| 'Suspense'
		| 'Teleport'
	> { }
	var __VLS_defineComponent: PickNotAny<typeof defineComponent_1, typeof defineComponent_2>;
	function __VLS_getVforSourceType<T>(source: T): T extends number ? number[] : T;
	function __VLS_getVforKeyType<T>(source: T): T extends any[] ? number : keyof T;
	function __VLS_getVforIndexType<T>(source: T): T extends any[] ? undefined : number;
	function __VLS_pickNotAny<T, K>(t: T, k: K): PickNotAny<T, K>;
	type __VLS_PropsType<C> = C extends new (...args: any) => { $props: infer Props } ? Props : C extends FunctionalComponent<infer R> ? R : C;
	type __VLS_MapPropsTypeBase<T> = { [K in keyof T]: __VLS_PropsType<T[K]> };
	type __VLS_MapPropsType<T> = { [K in keyof T]: __VLS_PropsType<T[K]> & Omit<__VLS_GlobalAttrs, keyof __VLS_PropsType<T[K]>> & Record<string, unknown> };
	type __VLS_MapEmitType<T> = { [K in keyof T]: __VLS_ExtractEmit2<T[K]> };
	type __VLS_ExtractEmit2<T> = T extends new (...args: any) => { $emit: infer Emit } ? Emit : unknown;
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
	type __VLS_EmitEvent<T, E> = T extends { __VLS_raw: infer R } ? __VLS_EmitEvent0<R, E> : __VLS_EmitEvent0<T, E>;
	type __VLS_EmitEvent0<T, E> =
		T extends DefineComponent<infer _, infer E2> ? (
			E2 extends (infer K)[] ? (E extends K ? (...args: any) => void : unknown) // emits: ['event-1', 'event-2']
			: E extends keyof E2 ? __VLS_ReturnVoid<E2[E]> : unknown // evnts: { 'event-1': () => true, 'event-2': () => true }
		) : __VLS_EmitEvent2<__VLS_ExtractEmit2<T>, E>;
	type __VLS_FirstFunction<F0, F1> =
		NonNullable<F0> extends (...args: any) => any ? F0 :
		NonNullable<F1> extends (...args: any) => any ? F1 : unknown;
	type __VLS_GlobalAttrsBase = VNodeProps & AllowedComponentProps;
	type __VLS_GlobalAttrs = __VLS_GlobalAttrsBase & HTMLAttributes;
	type __VLS_DefinePropsToOptions<T> = { [K in keyof T]-?: { type: PropType<T[K]>, required: {} extends Pick<T, K> ? false : true } };
	type __VLS_PickComponents<T> = { [K in keyof T as T[K] extends (new (...args: any) => any) | FunctionalComponent<infer _> ? K : never]: T[K] };
	type __VLS_SlotExpMap<K extends string | number | symbol, T> = { [day in K]: T };

	${genConstructorOverloads()}
}

declare const app: App;
app.component${SearchTexts.AppComponentCall};
`;

	return TextDocument.create(fsPathToUri(join(root, '__VLS_globals.ts')), 'typescript', 0, code);
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
