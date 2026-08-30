import type { VueCompilerOptions } from '../types';
import { endOfLine, isTsLang, newLine } from './utils';

export function getLocalTypesGenerator(vueCompilerOptions: VueCompilerOptions, lang: string) {
	const used = new Set<string>();
	const isTs = isTsLang(lang);

	const WithDefaults = defineHelper(
		`__VLS_WithDefaults`,
		() =>
			isTs
				? `
type __VLS_WithDefaults<P, D> = {
	[K in keyof Pick<P, keyof P>]: K extends keyof D
		? ${PrettifyLocal.name}<P[K] & { default: D[K] }>
		: P[K]
};
`.trimStart()
				: jsTypedef(
					`P, D`,
					`__VLS_WithDefaults`,
					`{ [K in keyof Pick<P, keyof P>]: K extends keyof D ? ${PrettifyLocal.name}<P[K] & { default: D[K] }> : P[K] }`,
				),
	);
	const PrettifyLocal = defineHelper(
		`__VLS_PrettifyLocal`,
		() =>
			isTs
				? `type __VLS_PrettifyLocal<T> = (T extends any ? { [K in keyof T]: T[K]; } : { [K in keyof T as K]: T[K]; }) & {}${endOfLine}`
				: jsTypedef(
					`T`,
					`__VLS_PrettifyLocal`,
					`(T extends any ? { [K in keyof T]: T[K]; } : { [K in keyof T as K]: T[K]; }) & {}`,
				),
	);
	const WithSlots = defineHelper(
		`__VLS_WithSlots`,
		() =>
			isTs
				? `
type __VLS_WithSlots<T, S> = T & {
	new(): {
		$slots: S;
	}
};
`.trimStart()
				: jsTypedef(`T, S`, `__VLS_WithSlots`, `T & { new(): { $slots: S; } }`),
	);
	const TypePropsToOption = defineHelper(
		`__VLS_TypePropsToOption`,
		() =>
			isTs
				? `
type __VLS_TypePropsToOption<T> = {
	[K in keyof T]-?: {} extends Pick<T, K>
		? { type: import('${vueCompilerOptions.lib}').PropType<Required<T>[K]> }
		: { type: import('${vueCompilerOptions.lib}').PropType<T[K]>, required: true }
};
`.trimStart()
				: jsTypedef(
					`T`,
					`__VLS_TypePropsToOption`,
					`{ [K in keyof T]-?: {} extends Pick<T, K> ? { type: import('${vueCompilerOptions.lib}').PropType<Required<T>[K]> } : { type: import('${vueCompilerOptions.lib}').PropType<T[K]>, required: true } }`,
				),
	);
	const OmitIndexSignature = defineHelper(
		`__VLS_OmitIndexSignature`,
		() =>
			isTs
				? `type __VLS_OmitIndexSignature<T> = { [K in keyof T as {} extends Record<K, unknown> ? never : K]: T[K]; }${endOfLine}`
				: jsTypedef(
					`T`,
					`__VLS_OmitIndexSignature`,
					`{ [K in keyof T as {} extends Record<K, unknown> ? never : K]: T[K] }`,
				),
	);
	const helpers = {
		[PrettifyLocal.name]: PrettifyLocal,
		[WithDefaults.name]: WithDefaults,
		[WithSlots.name]: WithSlots,
		[TypePropsToOption.name]: TypePropsToOption,
		[OmitIndexSignature.name]: OmitIndexSignature,
	};
	used.clear();

	return {
		generate,
		get PrettifyLocal() {
			return PrettifyLocal.name;
		},
		get WithDefaults() {
			return WithDefaults.name;
		},
		get WithSlots() {
			return WithSlots.name;
		},
		get TypePropsToOption() {
			return TypePropsToOption.name;
		},
		get OmitIndexSignature() {
			return OmitIndexSignature.name;
		},
	};

	function* generate() {
		for (const name of used) {
			yield helpers[name]!.generate();
		}
		used.clear();
	}

	function jsTypedef(params: string, name: string, body: string) {
		return `/**${newLine} * @template ${params}${newLine} * @typedef {${body}} ${name}${newLine} */${newLine}`;
	}

	function defineHelper(name: string, generate: () => string) {
		return {
			get name() {
				used.add(name);
				return name;
			},
			generate,
		};
	}
}
