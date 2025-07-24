import type { DocumentHighlightKind, LanguageServicePlugin } from '@volar/language-service';
import type * as ts from 'typescript';
import { getEmbeddedInfo } from './utils';

export function create(
	getDocumentHighlights: (fileName: string, position: number) => Promise<ts.DocumentHighlights[] | null>,
): LanguageServicePlugin {
	return {
		name: 'vue-document-highlights',
		capabilities: {
			documentHighlightProvider: true,
		},
		create(context) {
			return {
				async provideDocumentHighlights(document, position) {
					const info = getEmbeddedInfo(context, document, 'main');
					if (!info) {
						return;
					}
					const { root } = info;

					const result = await getDocumentHighlights(root.fileName, document.offsetAt(position));

					return result
						?.filter(({ fileName }) => fileName === root.fileName)
						.flatMap(({ highlightSpans }) => highlightSpans)
						.map(({ textSpan, kind }) => ({
							range: {
								start: document.positionAt(textSpan.start),
								end: document.positionAt(textSpan.start + textSpan.length),
							},
							kind: kind === 'reference'
								? 2 satisfies typeof DocumentHighlightKind.Read
								: kind === 'writtenReference'
								? 3 satisfies typeof DocumentHighlightKind.Write
								: 1 satisfies typeof DocumentHighlightKind.Text,
						}));
				},
			};
		},
	};
}
