import type { LanguageServiceContext, LanguageServicePlugin } from '@volar/language-service';
import { VueVirtualCode } from '@vue/language-core';
import { convertClassificationsToSemanticTokens } from 'volar-service-typescript/lib/semanticFeatures/semanticTokens';
import { URI } from 'vscode-uri';

export function create(
	getTsPluginClient?: (
		context: LanguageServiceContext,
	) => import('@vue/typescript-plugin/lib/requests').Requests | undefined,
): LanguageServicePlugin {
	return {
		name: 'typescript-highlights',
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
			const tsPluginClient = getTsPluginClient?.(context);

			return {
				async provideDocumentSemanticTokens(document, range, legend) {
					const uri = URI.parse(document.uri);
					const decoded = context.decodeEmbeddedDocumentUri(uri);
					const sourceScript = decoded && context.language.scripts.get(decoded[0]);
					const virtualCode = decoded && sourceScript?.generated?.embeddedCodes.get(decoded[1]);
					if (!sourceScript?.generated || virtualCode?.id !== 'main') {
						return;
					}

					const root = sourceScript.generated.root;
					if (!(root instanceof VueVirtualCode)) {
						return;
					}

					const start = document.offsetAt(range.start);
					const end = document.offsetAt(range.end);
					const span = {
						start: start,
						length: end - start,
					};
					const classifications = await tsPluginClient?.getEncodedSemanticClassifications(
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
