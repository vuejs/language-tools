import type * as ts from 'typescript';
import {
	Hover,
	MarkupContent,
	MarkupKind,
	Range,
	Position,
} from 'vscode-languageserver/node';
import * as previewer from '../utils/previewer';
import { uriToFsPath, fsPathToUri } from '@volar/shared';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type * as Proto from '../protocol';

export function register(languageService: ts.LanguageService, getTextDocument: (uri: string) => TextDocument | undefined, ts: typeof import('typescript')) {
	return (uri: string, position: Position, documentOnly = false): Hover | undefined => {
		const document = getTextDocument(uri);
		if (!document) return;

		const fileName = uriToFsPath(document.uri);
		const offset = document.offsetAt(position);
		const info = languageService.getQuickInfoAtPosition(fileName, offset);
		if (!info) return;

		const parts: string[] = [];
		const displayString = ts.displayPartsToString(info.displayParts);
		// fix https://github.com/johnsoncodehk/volar/issues/289
		const mapedTags = info.tags?.map(tag => {
			if (tag.text) {
				return {
					...tag,
					text: tag.text.map(part => {
						let target: undefined | Proto.FileSpan | {
							fileName: string,
							textSpan: { start: number, length: number },
						} = (part as any).target;
						if (target && 'fileName' in target) {
							const fileDoc = getTextDocument(uriToFsPath(target.fileName))!;
							const start = fileDoc.positionAt(target.textSpan.start);
							const end = fileDoc.positionAt(target.textSpan.start + target.textSpan.length);
							target = {
								file: target.fileName,
								start: {
									line: start.line + 1,
									offset: start.character + 1,
								},
								end: {
									line: end.line + 1,
									offset: end.character + 1,
								},
							};
							return {
								...part,
								target,
							};
						}
						return part;
					}),
				}
			}
			return tag;
		}) ?? [];
		const documentation = previewer.markdownDocumentation(info.documentation ?? [], mapedTags, { toResource: fsPathToUri });

		if (displayString && !documentOnly) {
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
