import { getSlotsPropertyName } from '../../utils/shared';
import { newLine } from '../common';
import type { ScriptCodegenOptions } from './index';

interface HelperType {
	name: string;
	used?: boolean;
	generated?: boolean;
	code: string;
}

export type ScriptCodegenContext = ReturnType<typeof createScriptCodegenContext>;

export function createScriptCodegenContext(options: ScriptCodegenOptions) {
	const helperTypes = {
		OmitKeepDiscriminatedUnion: {
			get name() {
				this.used = true;
				return `__VLS_OmitKeepDiscriminatedUnion`;
			},
			get code() {
				return `type __VLS_OmitKeepDiscriminatedUnion<T, K extends keyof any> = T extends any
					? Pick<T, Exclude<keyof T, K>>
					: never;`;
			},
		} satisfies HelperType as HelperType,
		WithDefaults: {
			get name() {
				this.used = true;
				return `__VLS_WithDefaults`;
			},
			get code(): string {
				return `type __VLS_WithDefaults<P, D> = {
					[K in keyof Pick<P, keyof P>]: K extends keyof D
						? ${helperTypes.Prettify.name}<P[K] & { default: D[K]}>
						: P[K]
				};`;
			},
		} satisfies HelperType as HelperType,
		Prettify: {
			get name() {
				this.used = true;
				return `__VLS_Prettify`;
			},
			get code() {
				return `type __VLS_Prettify<T> = { [K in keyof T]: T[K]; } & {};`;
			},
		} satisfies HelperType as HelperType,
		WithTemplateSlots: {
			get name() {
				this.used = true;
				return `__VLS_WithTemplateSlots`;
			},
			get code(): string {
				return `type __VLS_WithTemplateSlots<T, S> = T & {
					new(): {
						${getSlotsPropertyName(options.vueCompilerOptions.target)}: S;
						${options.vueCompilerOptions.jsxSlots ? `$props: ${helperTypes.PropsChildren.name}<S>;` : ''}
					}
				};`;
			},
		} satisfies HelperType as HelperType,
		PropsChildren: {
			get name() {
				this.used = true;
				return `__VLS_PropsChildren`;
			},
			get code() {
				return `type __VLS_PropsChildren<S> = {
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
				};`;
			},
		} satisfies HelperType as HelperType,
		TypePropsToOption: {
			get name() {
				this.used = true;
				return `__VLS_TypePropsToOption`;
			},
			get code() {
				return options.compilerOptions.exactOptionalPropertyTypes ?
					`type __VLS_TypePropsToOption<T> = {
						[K in keyof T]-?: {} extends Pick<T, K>
							? { type: import('${options.vueCompilerOptions.lib}').PropType<T[K]> }
							: { type: import('${options.vueCompilerOptions.lib}').PropType<T[K]>, required: true }
					};` :
					`type __VLS_NonUndefinedable<T> = T extends undefined ? never : T;
					type __VLS_TypePropsToOption<T> = {
						[K in keyof T]-?: {} extends Pick<T, K>
							? { type: import('${options.vueCompilerOptions.lib}').PropType<__VLS_NonUndefinedable<T[K]>> }
							: { type: import('${options.vueCompilerOptions.lib}').PropType<T[K]>, required: true }
					};`;
			},
		} satisfies HelperType as HelperType,
	};

	return {
		generatedTemplate: false,
		generatedPropsType: false,
		scriptSetupGeneratedOffset: undefined as number | undefined,
		bypassDefineComponent: options.lang === 'js' || options.lang === 'jsx',
		bindingNames: new Set([
			...options.scriptRanges?.bindings.map(range => options.sfc.script!.content.substring(range.start, range.end)) ?? [],
			...options.scriptSetupRanges?.bindings.map(range => options.sfc.scriptSetup!.content.substring(range.start, range.end)) ?? [],
		]),
		helperTypes,
		generateHelperTypes,
	};

	function* generateHelperTypes() {
		let shouldCheck = true;
		while (shouldCheck) {
			shouldCheck = false;
			for (const helperType of Object.values(helperTypes)) {
				if (helperType.used && !helperType.generated) {
					shouldCheck = true;
					helperType.generated = true;
					yield newLine + helperType.code + newLine;
				}
			}
		}
	}
}
