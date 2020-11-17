import * as ts from 'typescript';
import {
	Hover,
	TextDocument,
	MarkupContent,
	MarkupKind,
	Range,
	Position,
} from 'vscode-languageserver';
import * as previewer from '../utils/previewer';
import { uriToFsPath } from '@volar/shared';

export function register(languageService: ts.LanguageService) {
	return (document: TextDocument, position: Position): Hover | undefined => {
		const fileName = uriToFsPath(document.uri);
		const offset = document.offsetAt(position);
		const info = languageService.getQuickInfoAtPosition(fileName, offset);
		if (!info) return undefined;

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
