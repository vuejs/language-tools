import { InlayHintInfo } from '../types';
import { getLocalTypesGenerator } from '../localTypes';
import type { ScriptCodegenOptions } from './index';

export interface HelperType {
	name: string;
	used?: boolean;
	generated?: boolean;
	code: string;
}

export type ScriptCodegenContext = ReturnType<typeof createScriptCodegenContext>;

export function createScriptCodegenContext(options: ScriptCodegenOptions) {
	const localTypes = getLocalTypesGenerator(options.compilerOptions, options.vueCompilerOptions);
	const inlayHints: InlayHintInfo[] = [];

	return {
		generatedTemplate: false,
		generatedPropsType: false,
		scriptSetupGeneratedOffset: undefined as number | undefined,
		bypassDefineComponent: options.lang === 'js' || options.lang === 'jsx',
		bindingNames: new Set([
			...options.scriptRanges?.bindings.map(range => options.sfc.script!.content.substring(range.start, range.end)) ?? [],
			...options.scriptSetupRanges?.bindings.map(range => options.sfc.scriptSetup!.content.substring(range.start, range.end)) ?? [],
		]),
		localTypes,
		inlayHints,
	};
}
