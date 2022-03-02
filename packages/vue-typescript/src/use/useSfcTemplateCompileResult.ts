import * as vscode from 'vscode-languageserver-protocol';
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

		const errors: vscode.Diagnostic[] = [];
		const compiled = compileSFCTemplate(
			htmlDocument.value.getText(),
			compilerOptions.experimentalTemplateCompilerOptions,
			compilerOptions.experimentalCompatMode ?? 3,
		);

		for (const error of compiled.errors) {
			onCompilerError(error, vscode.DiagnosticSeverity.Error);
		}
		for (const error of compiled.warnings) {
			onCompilerError(error, vscode.DiagnosticSeverity.Warning);
		}

		return {
			ast: compiled.ast,
			errors,
		};

		function onCompilerError(err: typeof compiled['errors'][number], severity: vscode.DiagnosticSeverity) {
			errors.push({
				range: {
					start: htmlDocument.value!.positionAt(err.loc?.start.offset ?? 0),
					end: htmlDocument.value!.positionAt(err.loc?.end.offset ?? 0),
				},
				severity,
				code: err.code,
				source: 'vue',
				message: err.message,
			});
		}
	});
}
