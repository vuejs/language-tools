import { TextDocument } from 'vscode-languageserver-textdocument';
import { SearchTexts } from './common';
import { fsPathToUri } from '@volar/shared';
import { join } from 'upath';

export function getGlobalDoc(root: string) {
	let code = `
import { FunctionalComponent } from '@vue/runtime-dom'
import { HTMLAttributes } from '@vue/runtime-dom'
import { VNodeProps } from '@vue/runtime-dom'
import { AllowedComponentProps } from '@vue/runtime-dom'
import { PropType } from '@vue/runtime-dom'
import { App } from '@vue/runtime-dom'
		
declare global {
	interface __VLS_GlobalComponents extends Pick<typeof import('@vue/runtime-dom'),
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
	type __VLS_MapPropsTypeBase<T> = { [K in keyof T]: __VLS_PropsType<T[K]> };
	type __VLS_MapPropsType<T> = { [K in keyof T]: __VLS_PropsType<T[K]> & Record<string, unknown> /* & Omit<__VLS_PropsType<T[K], keyof HTMLAttributes> */ };
	type __VLS_MapEmitType<T> = { [K in keyof T]: __VLS_RemoveAnyFnSet<T[K] extends new (...args: any) => { $emit: infer Emit } ? __VLS_ConstructorOverloads<Emit> : {}> };
	type __VLS_FirstFunction<F1, F2> = F1 extends undefined ? F2 : (F1 extends (...args: any) => any ? F1 : (F2 extends (...args: any) => any ? F2 : F1));
	type __VLS_RemoveAnyFnSet<T> = ({ 'Catch Me If You Can~!': any } extends T ? {} : T) & Record<string, undefined>;
	type __VLS_GlobalAttrs = HTMLAttributes & VNodeProps & AllowedComponentProps;
	type __VLS_PickFunc<A, B> = A extends (...args: any) => any ? A : B;
	type __VLS_DefinePropsToOptions<T> = { [K in keyof T]-?: { type: PropType<T[K]>, required: {} extends Pick<T, K> ? false : true } };
	type __VLS_PickComponents<T> = { [K in keyof T as T[K] extends new (...args: any) => any ? K : never]: T[K] };
	
`;
	{
		code += `type __VLS_ConstructorOverloads<T> =\n`;
		for (let i = 4; i >= 1; i--) {
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
	}
	code += `\n}\n`;
	code += `
declare const app: App;
app.component${SearchTexts.AppComponentCall};
`

	return TextDocument.create(fsPathToUri(join(root, '__VLS_globals.ts')), 'typescript', 0, code);
}
