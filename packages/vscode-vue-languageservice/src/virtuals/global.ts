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
import { FunctionalComponent } from '__VLS_vue';
import { HTMLAttributes } from '__VLS_vue';
import { VNodeProps } from '__VLS_vue';
import { AllowedComponentProps } from '__VLS_vue';
import { PropType } from '__VLS_vue';
import { App } from '__VLS_vue';

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
	type __VLS_MapEmitType<T> = { [K in keyof T]: T[K] extends new (...args: any) => { $emit: infer Emit } ? Emit : () => void };
	type __VLS_PickEmitFunction<F, E> =
		F extends {
			(event: E, ...payload: infer P): infer R
			(event: any, ...payload: any): any
		} ? (...payload: P) => R :
		F extends {
			(event: E, ...payload: infer P): infer R
		} ? (...payload: P) => R :
		undefined;
	type __VLS_FirstFunction<F1, F2> = NonNullable<F1> extends (...args: any) => any ? F1 : F2;
	type __VLS_GlobalAttrsBase = VNodeProps & AllowedComponentProps;
	type __VLS_GlobalAttrs = __VLS_GlobalAttrsBase & HTMLAttributes;
	type __VLS_DefinePropsToOptions<T> = { [K in keyof T]-?: { type: PropType<T[K]>, required: {} extends Pick<T, K> ? false : true } };
	type __VLS_PickComponents<T> = { [K in keyof T as T[K] extends (new (...args: any) => any) | FunctionalComponent ? K : never]: T[K] };
}

declare const app: App;
app.component${SearchTexts.AppComponentCall};
`;

	return TextDocument.create(fsPathToUri(join(root, '__VLS_globals.ts')), 'typescript', 0, code);
}
