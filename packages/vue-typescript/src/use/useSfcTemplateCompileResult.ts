import { TextDocument } from 'vscode-languageserver-textdocument';
import { computed, Ref } from '@vue/reactivity';
import { compileSFCTemplate } from '@volar/vue-code-gen';
import { VueCompilerOptions } from '../types';

export function useSfcTemplateCompileResult(
	htmlDocument: Ref<TextDocument | undefined>,
	compilerOptions: VueCompilerOptions,
) {
	return computed(() => {

		if (!htmlDocument.value)
			return;

		const compiled = compileSFCTemplate(
			htmlDocument.value.getText(),
			compilerOptions.experimentalTemplateCompilerOptions,
			compilerOptions.experimentalCompatMode ?? 3,
		);

		return compiled;
	});
}
