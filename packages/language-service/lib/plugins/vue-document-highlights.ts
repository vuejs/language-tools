import type { DocumentHighlightKind, LanguageServicePlugin } from '@volar/language-service';
import { VueVirtualCode } from '@vue/language-core';
import type * as ts from 'typescript';
import { URI } from 'vscode-uri';

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
					const uri = URI.parse(document.uri);
          const sourceFile = context.language.scripts.get(uri);
          const isScriptBlock = sourceFile?.generated?.embeddedCodes.has('script');
          const root = sourceFile?.generated?.root;
          if (!isScriptBlock || !(root instanceof VueVirtualCode)) {
            return;
          }

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
