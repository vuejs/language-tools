import * as ts from 'typescript';
import {
	TextDocument,
	Diagnostic,
	DiagnosticTag,
	DiagnosticSeverity,
} from 'vscode-languageserver';
import { uriToFsPath } from '@volar/shared';

export function register(languageService: ts.LanguageService) {
	return (document: TextDocument, options: { semantic?: boolean, syntactic?: boolean, suggestion?: boolean } = { semantic: true, syntactic: true, suggestion: true }): Diagnostic[] => {
		const fileName = uriToFsPath(document.uri);

		const diags_1 = options.semantic ? languageService.getSemanticDiagnostics(fileName) : [];
		const diags_2 = options.syntactic ? languageService.getSyntacticDiagnostics(fileName) : [];
		const diags_3 = options.suggestion ? languageService.getSuggestionDiagnostics(fileName) : [];

		return [
			...translateDiagnostics(diags_1),
			...translateDiagnostics(diags_2),
			...translateDiagnostics(diags_3),
		];

		function translateDiagnostics(input: ts.Diagnostic[]) {
			let output: Diagnostic[] = [];

			for (const diag of input) {
				if (diag.start === undefined) continue;
				if (diag.length === undefined) continue;

				const diagnostic: Diagnostic = {
					range: {
						start: document.positionAt(diag.start),
						end: document.positionAt(diag.start + diag.length),
					},
					severity: translateErrorType(diag.category),
					source: 'ts',
					code: diag.code,
					message: typeof diag.messageText === 'string' ? diag.messageText : diag.messageText.messageText,
				};

				if (diagnostic.source === 'ts' && diagnostic.code === 6133) {
					if (diagnostic.tags === undefined) diagnostic.tags = [];
					diagnostic.tags.push(DiagnosticTag.Unnecessary);
				}
				if (diagnostic.source === 'ts' && diagnostic.code === 6385) {
					if (diagnostic.tags === undefined) diagnostic.tags = [];
					diagnostic.tags.push(DiagnosticTag.Deprecated);
				}

				output.push(diagnostic);
			}

			return output;
		}
		function translateErrorType(input: ts.DiagnosticCategory): DiagnosticSeverity {
			switch (input) {
				case ts.DiagnosticCategory.Error: return DiagnosticSeverity.Error;
				case ts.DiagnosticCategory.Message: return DiagnosticSeverity.Information;
				case ts.DiagnosticCategory.Suggestion: return DiagnosticSeverity.Hint;
				case ts.DiagnosticCategory.Warning: return DiagnosticSeverity.Warning;
			}
		}
	};
}
