import * as vscode from 'vscode-languageserver-protocol';
import * as shared from '@volar/shared';
import type * as ts from 'typescript/lib/tsserverlibrary';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';

export function register(
	rootUri: URI,
	languageService: ts.LanguageService,
	getTextDocument: (uri: string) => TextDocument | undefined,
	ts: typeof import('typescript/lib/tsserverlibrary'),
) {
	return (
		uri: string,
		options: {
			semantic?: boolean,
			syntactic?: boolean,
			suggestion?: boolean,
			declaration?: boolean,
		},
		cancellationToken?: ts.CancellationToken,
	): vscode.Diagnostic[] => {
		const document = getTextDocument(uri);
		if (!document) return [];

		const fileName = shared.getPathOfUri(document.uri);
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
			return input.map(diag => translateDiagnostic(diag, document)).filter(shared.notEmpty);
		}
		function translateDiagnostic(diag: ts.Diagnostic, document: TextDocument): vscode.Diagnostic | undefined {

			if (diag.start === undefined) return;
			if (diag.length === undefined) return;

			const diagnostic: vscode.Diagnostic = {
				range: {
					start: document.positionAt(diag.start),
					end: document.positionAt(diag.start + diag.length),
				},
				severity: translateErrorType(diag.category),
				source: 'ts',
				code: diag.code,
				message: getMessageText(diag),
			};

			if (diag.relatedInformation) {
				diagnostic.relatedInformation = diag.relatedInformation
					.map(rErr => translateDiagnosticRelated(rErr))
					.filter(shared.notEmpty);
			}
			if (diag.reportsUnnecessary) {
				if (diagnostic.tags === undefined) diagnostic.tags = [];
				diagnostic.tags.push(vscode.DiagnosticTag.Unnecessary);
			}
			if (diag.reportsDeprecated) {
				if (diagnostic.tags === undefined) diagnostic.tags = [];
				diagnostic.tags.push(vscode.DiagnosticTag.Deprecated);
			}

			return diagnostic;
		}
		function translateDiagnosticRelated(diag: ts.Diagnostic): vscode.DiagnosticRelatedInformation | undefined {

			if (diag.start === undefined) return;
			if (diag.length === undefined) return;

			let document: TextDocument | undefined;
			if (diag.file) {
				document = getTextDocument(shared.getUriByPath(rootUri, diag.file.fileName));
			}
			if (!document) return;

			const diagnostic: vscode.DiagnosticRelatedInformation = {
				location: {
					uri: document.uri,
					range: {
						start: document.positionAt(diag.start),
						end: document.positionAt(diag.start + diag.length),
					},
				},
				message: getMessageText(diag),
			};

			return diagnostic;
		}
		function translateErrorType(input: ts.DiagnosticCategory): vscode.DiagnosticSeverity {
			switch (input) {
				case ts.DiagnosticCategory.Warning: return vscode.DiagnosticSeverity.Warning;
				case ts.DiagnosticCategory.Error: return vscode.DiagnosticSeverity.Error;
				case ts.DiagnosticCategory.Suggestion: return vscode.DiagnosticSeverity.Hint;
				case ts.DiagnosticCategory.Message: return vscode.DiagnosticSeverity.Information;
			}
			return vscode.DiagnosticSeverity.Error;
		}
	};
}

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
export function getEmitDeclarations(compilerOptions: ts.CompilerOptions): boolean {
	return !!(compilerOptions.declaration || compilerOptions.composite);
}
