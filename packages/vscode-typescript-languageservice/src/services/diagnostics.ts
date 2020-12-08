import {
	TextDocument,
	Diagnostic,
	DiagnosticTag,
	DiagnosticSeverity,
	Range,
} from 'vscode-languageserver/node';
import { uriToFsPath } from '@volar/shared';
import * as ts from 'typescript';
import * as errorCodes from '../utils/errorCodes';

// Style check diagnostics that can be reported as warnings
const styleCheckDiagnostics = new Set([
	...errorCodes.variableDeclaredButNeverUsed,
	...errorCodes.propertyDeclaretedButNeverUsed,
	...errorCodes.allImportsAreUnused,
	...errorCodes.unreachableCode,
	...errorCodes.unusedLabel,
	...errorCodes.fallThroughCaseInSwitch,
	...errorCodes.notAllCodePathsReturnAValue,
]);

export function register(languageService: ts.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined) {
	return (uri: string, options: { semantic?: boolean, syntactic?: boolean, suggestion?: boolean } = { semantic: true, syntactic: true, suggestion: true }): Diagnostic[] => {
		const document = getTextDocument(uri);
		if (!document) {
			if (options.suggestion) {
				return [
					Diagnostic.create(
						Range.create(0, 0, 0, 0),
						'services not working for this script block because virtual file not found in TS server, maybe try to add lang="ts" to <script>, or add `"allowJs": true` to tsconfig.json',
						DiagnosticSeverity.Warning,
						undefined,
						'volar', // TODO
					)
				];
			}
			else {
				return [];
			}
		}

		const fileName = uriToFsPath(document.uri);

		const diags_1 = options.semantic ? languageService.getSemanticDiagnostics(fileName) : [];
		const diags_2 = options.syntactic ? languageService.getSyntacticDiagnostics(fileName) : [];
		const diags_3 = options.suggestion ? languageService.getSuggestionDiagnostics(fileName) : [];

		return [
			...translateDiagnostics(document, diags_1),
			...translateDiagnostics(document, diags_2),
			...translateDiagnostics(document, diags_3),
		];

		function translateDiagnostics(document: TextDocument, input: ts.Diagnostic[]) {
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

				if (diagnostic.source === 'ts' && typeof diagnostic.code === 'number' && styleCheckDiagnostics.has(diagnostic.code)) {
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
				case ts.DiagnosticCategory.Warning: return DiagnosticSeverity.Warning;
				case ts.DiagnosticCategory.Error: return DiagnosticSeverity.Error;
				case ts.DiagnosticCategory.Suggestion: return DiagnosticSeverity.Hint;
				case ts.DiagnosticCategory.Message: return DiagnosticSeverity.Information;
			}
		}
	};
}
