import { getLocalTypesGenerator } from '../localTypes';
import type { ScriptCodegenOptions } from './index';

export type ScriptCodegenContext = ReturnType<typeof createScriptCodegenContext>;

export function createScriptCodegenContext(options: ScriptCodegenOptions) {
	const localTypes = getLocalTypesGenerator(options.vueCompilerOptions, options.scriptLang);

	return {
		generatedTypes: new Set<string>(),
		localTypes,
	};
}
