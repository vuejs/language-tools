import type { DocumentHighlightKind, LanguageServicePlugin } from '@volar/language-service';
import { getEmbeddedInfo } from './utils';

export function create(
	tsPluginClient: import('@vue/typescript-plugin/lib/requests').Requests | undefined,
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

					const result = await tsPluginClient?.getDocumentHighlights(root.fileName, document.offsetAt(position));

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
