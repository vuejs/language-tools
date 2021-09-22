import * as vscode from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { computed, Ref } from '@vue/reactivity';
import * as CompilerDOM from '@vue/compiler-dom';
import * as CompilerVue2 from '../utils/vue2TemplateCompiler';

export function useSfcTemplateCompileResult(
	htmlDocument: Ref<TextDocument | undefined>,
	isVue2Mode: boolean,
) {
	return computed(() => {

		if (!htmlDocument.value)
			return;

		const errors: vscode.Diagnostic[] = [];
		let ast: CompilerDOM.RootNode | undefined;

		try {
			ast = (isVue2Mode ? CompilerVue2 : CompilerDOM).compile(htmlDocument.value.getText(), {
				onError: err => onCompilerError(err, vscode.DiagnosticSeverity.Error),
				onWarn: err => onCompilerError(err, vscode.DiagnosticSeverity.Warning),
				expressionPlugins: ['typescript'],
			}).ast;

			function onCompilerError(err: CompilerDOM.CompilerError, severity: vscode.DiagnosticSeverity) {
				
				if (!err.loc) return;

				const diagnostic: vscode.Diagnostic = {
					range: {
						start: htmlDocument.value!.positionAt(err.loc.start.offset),
						end: htmlDocument.value!.positionAt(err.loc.end.offset),
					},
					severity,
					code: err.code,
					source: 'vue',
					message: err.message,
				};
				errors.push(diagnostic);
			}
		}
		catch (e) {
			const err = e as CompilerDOM.CompilerError;
			const diagnostic: vscode.Diagnostic = {
				range: {
					start: htmlDocument.value.positionAt(0),
					end: htmlDocument.value.positionAt(htmlDocument.value.getText().length),
				},
				severity: vscode.DiagnosticSeverity.Error,
				code: err.code,
				source: 'vue',
				message: err.message,
			};
			errors.push(diagnostic);
		}

		return {
			errors,
			ast,
		};
	});
}
