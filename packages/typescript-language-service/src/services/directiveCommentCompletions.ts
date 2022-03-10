import * as vscode from 'vscode-languageserver-protocol';
import * as nls from 'vscode-nls';
import type { TextDocument } from 'vscode-languageserver-textdocument';

const localize = nls.loadMessageBundle(); // TODO: not working

interface Directive {
	readonly value: string;
	readonly description: string;
}

const directives: Directive[] = [
	{
		value: '@ts-check',
		description: localize(
			'ts-check',
			"Enables semantic checking in a JavaScript file. Must be at the top of a file.")
	}, {
		value: '@ts-nocheck',
		description: localize(
			'ts-nocheck',
			"Disables semantic checking in a JavaScript file. Must be at the top of a file.")
	}, {
		value: '@ts-ignore',
		description: localize(
			'ts-ignore',
			"Suppresses @ts-check errors on the next line of a file.")
	}, {
		value: '@ts-expect-error',
		description: localize(
			'ts-expect-error',
			"Suppresses @ts-check errors on the next line of a file, expecting at least one to exist.")
	}
];

export function register(
	getTextDocument: (uri: string) => TextDocument | undefined,
) {
	return (uri: string, position: vscode.Position) => {

		const document = getTextDocument(uri);
		if (!document)
			return;

		const prefix = document.getText({
			start: { line: position.line, character: 0 },
			end: position,
		});
		const match = prefix.match(/^\s*\/\/+\s?(@[a-zA-Z\-]*)?$/);
		if (match) {

			return directives.map(directive => {

				const item = vscode.CompletionItem.create(directive.value);
				item.insertTextFormat = vscode.InsertTextFormat.Snippet;
				item.detail = directive.description;
				const range = vscode.Range.create(position.line, Math.max(0, position.character - (match[1] ? match[1].length : 0)), position.line, position.character);
				item.textEdit = vscode.TextEdit.replace(range, directive.value);

				return item;
			});
		}
		return [];
	}
}
