import { computed, Ref } from '@vue/reactivity';
import { compileSFCTemplate } from '@volar/vue-code-gen';
import { VueCompilerOptions } from '../types';

export function useSfcTemplateCompileResult(
	html: Ref<string | undefined>,
	compilerOptions: VueCompilerOptions,
) {
	return computed(() => {

		if (html.value === undefined)
			return;

		const compiled = compileSFCTemplate(
			html.value,
			compilerOptions.experimentalTemplateCompilerOptions,
			compilerOptions.experimentalCompatMode ?? 3,
		);

		return compiled;
	});
}
