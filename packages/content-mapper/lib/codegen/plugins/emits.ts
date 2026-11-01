import type { VueCodegenFile, VueCodegenFilePlugin } from '../plugin';
import { addDefineWithTypeTransforms } from '../script/scriptSetup';
import type { TsCode } from '../tsCode';

/**
 * The emits that `defineEmits` declares: its type argument, which the component checks against from Vue 3.5 unless it
 * is a union, and what it returns.
 */
export function createEmitsPlugin({ analysis, name }: VueCodegenFile): VueCodegenFilePlugin<TsCode> {
	const Emit = name('Emit');
	const emit = name('emit');
	const getDefineEmits = () => analysis.getScriptSetupRanges()?.defineEmits;
	return {
		rewrite({ scriptSetup }) {
			const defineEmits = getDefineEmits();
			if (!scriptSetup || !defineEmits) {
				return;
			}
			const { name, statement, callExp, typeArg } = defineEmits;
			addDefineWithTypeTransforms(scriptSetup, statement, callExp, typeArg, name, emit, Emit);
		},
		emits: () => {
			const defineEmits = getDefineEmits();
			if (!defineEmits) {
				return [];
			}
			return [{
				type: defineEmits.typeArg && !defineEmits.hasUnionTypeArg ? Emit : undefined,
				emit: `typeof ${defineEmits.name ?? emit}`,
			}];
		},
	};
}
