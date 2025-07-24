import type { LanguageServicePlugin } from '@volar/language-service';
import { convertClassificationsToSemanticTokens } from 'volar-service-typescript/lib/semanticFeatures/semanticTokens';
import { getEmbeddedInfo } from './utils';

export function create(
	{ getEncodedSemanticClassifications }: import('@vue/typescript-plugin/lib/requests').Requests,
): LanguageServicePlugin {
	return {
		name: 'typescript-semantic-tokens',
		capabilities: {
			semanticTokensProvider: {
				legend: {
					tokenTypes: [
						'namespace',
						'class',
						'enum',
						'interface',
						'typeParameter',
						'type',
						'parameter',
						'variable',
						'property',
						'enumMember',
						'function',
						'method',
					],
					tokenModifiers: [
						'declaration',
						'readonly',
						'static',
						'async',
						'defaultLibrary',
						'local',
					],
				},
			},
		},
		create(context) {
			return {
				async provideDocumentSemanticTokens(document, range, legend) {
					const info = getEmbeddedInfo(context, document, 'main');
					if (!info) {
						return;
					}
					const { root } = info;

					const start = document.offsetAt(range.start);
					const end = document.offsetAt(range.end);
					const span = {
						start: start,
						length: end - start,
					};
					const classifications = await getEncodedSemanticClassifications(
						root.fileName,
						span,
					);

					if (classifications) {
						return convertClassificationsToSemanticTokens(document, span, legend, classifications);
					}
				},
			};
		},
	};
}
