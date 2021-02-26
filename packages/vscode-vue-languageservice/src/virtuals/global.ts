import { TextDocument } from 'vscode-languageserver-textdocument';
import { SearchTexts } from '../utils/string';
import { fsPathToUri } from '@volar/shared';
import { join } from 'upath';

export function getGlobalDTs(root: string) {
	let code = `
declare module '__VLS_vue' {
	export * from 'vue'; // #37
	export * from '@vue/runtime-dom';
}
`;

	return TextDocument.create(fsPathToUri(join(root, '__VLS_vue.d.ts')), 'typescript', 0, code);
}

export function getGlobalDoc(root: string) {
	let code = `
import type { FunctionalComponent } from '__VLS_vue';
import type { HTMLAttributes } from '__VLS_vue';
import type { VNodeProps } from '__VLS_vue';
import type { AllowedComponentProps } from '__VLS_vue';
import type { PropType } from '__VLS_vue';
import type { App } from '__VLS_vue';
import type { DefineComponent } from '__VLS_vue';

declare global {
	interface __VLS_GlobalComponents extends Pick<typeof import('__VLS_vue'),
		'Transition'
		| 'TransitionGroup'
		| 'KeepAlive'
		| 'Suspense'
		| 'Teleport'
	> { }
	var __VLS_for_key: string;
	function __VLS_getVforSourceType<T>(source: T): T extends number ? number[] : T;
	function __VLS_getVforKeyType<T>(source: T): T extends any[] ? number : string;
	function __VLS_getVforIndexType<T>(source: T): T extends any[] ? undefined : number;
	type __VLS_PropsType<C> = C extends new (...args: any) => { $props: infer Props } ? Props : C extends FunctionalComponent<infer R> ? R : C;
	type __VLS_MapPropsTypeBase<T> = { [K in keyof T]: Omit<__VLS_PropsType<T[K]>, keyof __VLS_GlobalAttrsBase> /* __VLS_GlobalAttrs has perf issue with Omit<> */ };
	type __VLS_MapPropsType<T> = { [K in keyof T]: __VLS_PropsType<T[K]> & Omit<__VLS_GlobalAttrs, keyof __VLS_PropsType<T[K]>> & Record<string, unknown> };
	type __VLS_MapEmitType<T> = { [K in keyof T]: __VLS_ExtractEmit2<T[K]> };
	type __VLS_ExtractEmit2<T> = T extends new (...args: any) => { $emit: infer Emit } ? Emit : never;
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
		: (...payload: any[]) => void | '[volar type warning] volar cloud not infer $emit event more than 4 overloads without DefineComponent. see https://github.com/johnsoncodehk/volar/issues/60';
	type __VLS_EmitEvent<T, E> = T extends { __VLS_raw: infer R } ? __VLS_EmitEvent0<R, E> : __VLS_EmitEvent0<T, E>;
	type __VLS_EmitEvent0<T, E> =
		T extends DefineComponent<infer _, any, any, any, any, any, any, infer E2> ? (
			E2 extends (infer K)[] ? (E extends K ? (...args: any) => void : never) // emits: ['event-1', 'event-2']
			: E extends keyof E2 ? __VLS_ReturnVoid<E2[E]> : never // evnts: { 'event-1': () => true, 'event-2': () => true }
		) : __VLS_EmitEvent2<__VLS_ExtractEmit2<T>, E>;
	type __VLS_FirstFunction<F1, F2> = NonNullable<F1> extends (...args: any) => any ? F1 : F2;
	type __VLS_GlobalAttrsBase = VNodeProps & AllowedComponentProps;
	type __VLS_GlobalAttrs = __VLS_GlobalAttrsBase & HTMLAttributes;
	type __VLS_DefinePropsToOptions<T> = { [K in keyof T]-?: { type: PropType<T[K]>, required: {} extends Pick<T, K> ? false : true } };
	type __VLS_PickComponents<T> = { [K in keyof T as T[K] extends (new (...args: any) => any) | FunctionalComponent<infer _> ? K : never]: T[K] };
	type __VLS_SlotExpMap<K extends string | number | symbol, T> = { [day in K]: T };
}

declare const app: App;
app.component${SearchTexts.AppComponentCall};
`;

	return TextDocument.create(fsPathToUri(join(root, '__VLS_globals.ts')), 'typescript', 0, code);
}
