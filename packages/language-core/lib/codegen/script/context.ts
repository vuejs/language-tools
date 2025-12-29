import type { InlayHintInfo } from '../inlayHints';
import { getLocalTypesGenerator } from '../localTypes';
import type { ScriptCodegenOptions } from './index';

export type ScriptCodegenContext = ReturnType<typeof createScriptCodegenContext>;

export function createScriptCodegenContext(options: ScriptCodegenOptions) {
	const localTypes = getLocalTypesGenerator(options.vueCompilerOptions);
	const inlayHints: InlayHintInfo[] = [];

	return {
		generatedTypes: new Set<string>(),
		localTypes,
		inlayHints,
	};
}
