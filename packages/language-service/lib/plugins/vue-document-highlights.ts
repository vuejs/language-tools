import type { DocumentHighlightKind, LanguageServicePlugin } from '@volar/language-service';
import { forEachElementNode, getElementTagOffsets } from '@vue/language-core';
import { resolveEmbeddedCode } from '../utils';

export function create(
	{ getDocumentHighlights }: import('@vue/typescript-plugin/lib/requests').Requests,
): LanguageServicePlugin {
	return {
		name: 'vue-document-highlights',
		capabilities: {
			documentHighlightProvider: true,
		},
		create(context) {
			return {
				async provideDocumentHighlights(document, position) {
					const info = resolveEmbeddedCode(context, document.uri);
					if (info?.code.id !== 'main') {
						return;
					}

					const { template } = info.root.sfc;
					const offset = document.offsetAt(position);

					if (template?.ast && offset >= template.startTagEnd && offset <= template.endTagStart) {
						const pos = offset - template.startTagEnd;
						for (const node of forEachElementNode(template.ast)) {
							if (pos < node.loc.start.offset || pos > node.loc.end.offset) {
								continue;
							}
							for (const tagOffset of getElementTagOffsets(node, template)) {
								if (pos >= tagOffset && pos <= tagOffset + node.tag.length) {
									return;
								}
							}
						}
					}

					const result = await getDocumentHighlights(info.root.fileName, offset);

					return result
						?.filter(({ fileName }) => fileName === info.root.fileName)
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
