import type { VueCompilerOptions } from '@vue/language-core';
import { endOfLine, isTsLang, newLine } from '../writers';

export function getLocalTypesGenerator(vueCompilerOptions: VueCompilerOptions, lang: string) {
	const used = new Set<string>();
	const isTs = isTsLang(lang);

	const WithDefaults = defineHelper(
		`__VLS_WithDefaults`,
		() =>
			isTs
				? `
type __VLS_WithDefaults<P, D> = {
	[K in keyof P & string]: K extends keyof D
		? ${PrettifyLocal.name}<P[K] & { default: D[K] }>
		: P[K]
};
`.trimStart()
				: jsGenericAlias(
					`P, D`,
					`__VLS_WithDefaults`,
					`{ [K in keyof Pick<P, keyof P>]: K extends keyof D ? ${
						reference(PrettifyLocal.name, `P[K] & { default: D[K] }`)
					} : P[K] }`,
				),
	);
	const PrettifyLocal = defineHelper(
		`__VLS_PrettifyLocal`,
		() =>
			isTs
				? `type __VLS_PrettifyLocal<T> = (T extends any ? { [K in keyof T]: T[K]; } : { [K in keyof T as K]: T[K]; }) & {}${endOfLine}`
				: jsGenericAlias(
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
				: jsGenericAlias(`T, S`, `__VLS_WithSlots`, `T & { new(): { $slots: S; } }`),
	);
	// `DefineComponent` keeps a type-based `emits` only as resolved options, whose properties are new symbols;
	// the parent resolves the declared events from `__typeEmits`, so that its listeners link to them
	const WithTypeEmits = defineHelper(
		`__VLS_WithTypeEmits`,
		() =>
			isTs
				? `type __VLS_WithTypeEmits<T, E> = T & { __typeEmits?: E; }${endOfLine}`
				: jsGenericAlias(`T, E`, `__VLS_WithTypeEmits`, `T & { __typeEmits?: E; }`),
	);
	const PropsChildren = defineHelper(
		`__VLS_PropsChildren`,
		() =>
			isTs
				? `
type __VLS_PropsChildren<S> = {
	[K in keyof (
		boolean extends (
			// @ts-ignore
			JSX.ElementChildrenAttribute extends never
				? true
				: false
		)
			? never
			// @ts-ignore
			: JSX.ElementChildrenAttribute
	)]?: S;
};
`.trimStart()
				// The single-line form lets the preceding @ts-ignore cover the whole declaration,
				// mirroring the inline @ts-ignore guards of the TS form.
				: `// @ts-ignore${newLine}var __VLS_PropsChildren = /** @type {<S>() => { [K in keyof (boolean extends (JSX.ElementChildrenAttribute extends never ? true : false) ? never : JSX.ElementChildrenAttribute)]?: S; }} */ ({})${endOfLine}`,
	);
	const TypePropsToOption = defineHelper(
		`__VLS_TypePropsToOption`,
		() =>
			isTs
				? `
type __VLS_TypePropsToOption<T> = {
	[K in keyof T & string]-?: {} extends Pick<T, K>
		? { type: import('${vueCompilerOptions.lib}').PropType<Required<T>[K]> }
		: { type: import('${vueCompilerOptions.lib}').PropType<T[K]>, required: true }
};
`.trimStart()
				: jsGenericAlias(
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
				: jsGenericAlias(
					`T`,
					`__VLS_OmitIndexSignature`,
					`{ [K in keyof T as {} extends Record<K, unknown> ? never : K]: T[K] }`,
				),
	);
	const helpers = {
		[PrettifyLocal.name]: PrettifyLocal,
		[WithDefaults.name]: WithDefaults,
		[WithSlots.name]: WithSlots,
		[WithTypeEmits.name]: WithTypeEmits,
		[PropsChildren.name]: PropsChildren,
		[TypePropsToOption.name]: TypePropsToOption,
		[OmitIndexSignature.name]: OmitIndexSignature,
	};
	used.clear();

	// Each getter marks its helper used before the type arguments are evaluated,
	// which keeps the order of the generated helpers.
	return {
		generate,
		get PrettifyLocal(): (type: string) => string {
			return instantiate(PrettifyLocal.name);
		},
		get WithDefaults(): (props: string, defaults: string) => string {
			return instantiate(WithDefaults.name);
		},
		get WithSlots(): (component: string, slots: string) => string {
			return instantiate(WithSlots.name);
		},
		get WithTypeEmits(): (component: string, typeEmits: string) => string {
			return instantiate(WithTypeEmits.name);
		},
		get PropsChildren(): (slots: string) => string {
			return instantiate(PropsChildren.name);
		},
		get TypePropsToOption(): (props: string) => string {
			return instantiate(TypePropsToOption.name);
		},
		get OmitIndexSignature(): (type: string) => string {
			return instantiate(OmitIndexSignature.name);
		},
	};

	function* generate() {
		for (const name of used) {
			yield helpers[name]!.generate();
		}
		used.clear();
	}

	function instantiate(name: string) {
		return (...typeArgs: string[]) => reference(name, ...typeArgs);
	}

	function reference(name: string, ...typeArgs: string[]) {
		const instantiation = `${name}<${typeArgs.join(', ')}>`;
		return isTs ? instantiation : `ReturnType<typeof ${instantiation}>`;
	}

	// A top-level `@typedef` would be an export of the JS module, so the alias is
	// the return type of a generic function type, instantiated by `reference`.
	function jsGenericAlias(params: string, name: string, body: string) {
		return `var ${name} = /** @type {<${params}>() => ${body}} */ ({})${endOfLine}`;
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
