import {
	Diagnostic,
	DiagnosticTag,
	DiagnosticSeverity,
} from 'vscode-languageserver/node';
import { uriToFsPath } from '@volar/shared';
import type * as ts from 'typescript';
import type { TextDocument } from 'vscode-languageserver-textdocument';

export function register(languageService: ts.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined, ts: typeof import('typescript')) {
	return (
		uri: string,
		options: {
			semantic?: boolean,
			syntactic?: boolean,
			suggestion?: boolean,
			declaration?: boolean,
		},
		cancellationToken?: ts.CancellationToken,
	): Diagnostic[] => {
		const document = getTextDocument(uri);
		if (!document) return [];

		const fileName = uriToFsPath(document.uri);
		const program = languageService.getProgram();
		const sourceFile = program?.getSourceFile(fileName);
		if (!program || !sourceFile) return [];

		let errors: ts.Diagnostic[] = [];

		try {
			errors = [
				...options.semantic ? program.getSemanticDiagnostics(sourceFile, cancellationToken) : [],
				...options.syntactic ? program.getSyntacticDiagnostics(sourceFile, cancellationToken) : [],
				...options.suggestion ? languageService.getSuggestionDiagnostics(fileName) : [],
			];

			if (options.declaration && getEmitDeclarations(program.getCompilerOptions())) {
				errors = errors.concat(program.getDeclarationDiagnostics(sourceFile, cancellationToken));
			}
		}
		catch { }

		return translateDiagnostics(document, errors);

		function translateDiagnostics(document: TextDocument, input: readonly ts.Diagnostic[]) {
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
					message: getMessageText(diag),
				};

				if (diag.reportsUnnecessary) {
					if (diagnostic.tags === undefined) diagnostic.tags = [];
					diagnostic.tags.push(DiagnosticTag.Unnecessary);
				}
				if (diag.reportsDeprecated) {
					if (diagnostic.tags === undefined) diagnostic.tags = [];
					diagnostic.tags.push(DiagnosticTag.Deprecated);
				}

				output.push(diagnostic);
				function getMessageText(diag: ts.Diagnostic | ts.DiagnosticMessageChain, level = 0) {
					let messageText = '  '.repeat(level);

					if (typeof diag.messageText === 'string') {
						messageText += diag.messageText;
					}
					else {
						messageText += diag.messageText.messageText;
						if (diag.messageText.next) {
							for (const info of diag.messageText.next) {
								messageText += '\n' + getMessageText(info, level + 1);
							}
						}
					}

					return messageText;
				}
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

export function getEmitDeclarations(compilerOptions: ts.CompilerOptions): boolean {
	return !!(compilerOptions.declaration || compilerOptions.composite);
}
