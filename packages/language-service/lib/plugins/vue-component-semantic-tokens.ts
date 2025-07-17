import type { LanguageServiceContext, LanguageServicePlugin, SemanticToken } from '@volar/language-service';
import { forEachElementNode, hyphenateTag, VueVirtualCode } from '@vue/language-core';
import type * as ts from 'typescript';
import { URI } from 'vscode-uri';

export function create(
	getTsPluginClient?: (
		context: LanguageServiceContext,
	) => import('@vue/typescript-plugin/lib/requests').Requests | undefined,
): LanguageServicePlugin {
	return {
		name: 'vue-component-highlights',
		capabilities: {
			semanticTokensProvider: {
				legend: {
					tokenTypes: ['component'],
					tokenModifiers: [],
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
					if (!sourceScript?.generated || virtualCode?.id !== 'template') {
						return;
					}

					const root = sourceScript.generated.root;
					if (!(root instanceof VueVirtualCode)) {
						return;
					}

					const { template } = root.sfc;
					if (!template) {
						return;
					}

					const result: SemanticToken[] = [];

					const tokenTypes = legend.tokenTypes.indexOf('component');
					const componentSpans = await getComponentSpans(root.fileName, template, {
						start: document.offsetAt(range.start),
						length: document.offsetAt(range.end) - document.offsetAt(range.start),
					});

					for (const span of componentSpans) {
						const position = document.positionAt(span.start);
						result.push([
							position.line,
							position.character,
							span.length,
							tokenTypes,
							0,
						]);
					}
					return result;
				},
			};

			async function getComponentSpans(
				fileName: string,
				template: NonNullable<VueVirtualCode['_sfc']['template']>,
				spanTemplateRange: ts.TextSpan,
			) {
				const result: ts.TextSpan[] = [];
				const validComponentNames = await tsPluginClient?.getComponentNames(fileName) ?? [];
				const elements = new Set(await tsPluginClient?.getElementNames(fileName) ?? []);
				const components = new Set([
					...validComponentNames,
					...validComponentNames.map(hyphenateTag),
				]);

				if (template.ast) {
					for (const node of forEachElementNode(template.ast)) {
						if (
							node.loc.end.offset <= spanTemplateRange.start
							|| node.loc.start.offset >= (spanTemplateRange.start + spanTemplateRange.length)
						) {
							continue;
						}
						if (components.has(node.tag) && !elements.has(node.tag)) {
							let start = node.loc.start.offset;
							if (template.lang === 'html') {
								start += '<'.length;
							}
							result.push({
								start,
								length: node.tag.length,
							});
							if (template.lang === 'html' && !node.isSelfClosing) {
								result.push({
									start: node.loc.start.offset + node.loc.source.lastIndexOf(node.tag),
									length: node.tag.length,
								});
							}
						}
					}
				}
				return result;
			}
		},
	};
}
