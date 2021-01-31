import type * as ts from 'typescript';
import {
	Hover,
	MarkupContent,
	MarkupKind,
	Range,
	Position,
} from 'vscode-languageserver/node';
import * as previewer from '../utils/previewer';
import { uriToFsPath } from '@volar/shared';
import type { TextDocument } from 'vscode-languageserver-textdocument';

export function register(languageService: ts.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined, ts: typeof import('typescript')) {
	return (uri: string, position: Position): Hover | undefined => {
		const document = getTextDocument(uri);
		if (!document) return;

		const fileName = uriToFsPath(document.uri);
		const offset = document.offsetAt(position);
		const info = languageService.getQuickInfoAtPosition(fileName, offset);
		if (!info) return;

		const parts: string[] = [];
		const displayString = ts.displayPartsToString(info.displayParts);
		const documentation = previewer.markdownDocumentation(info.documentation, info.tags);

		if (displayString) {
			parts.push(['```typescript', displayString, '```'].join('\n'));
		}
		if (documentation) {
			parts.push(documentation);
		}

		const markdown: MarkupContent = {
			kind: MarkupKind.Markdown,
			value: parts.join('\n\n'),
		};

		return {
			contents: markdown,
			range: Range.create(
				document.positionAt(info.textSpan.start),
				document.positionAt(info.textSpan.start + info.textSpan.length),
			),
		};
	};
}
