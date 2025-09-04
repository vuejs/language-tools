import type { LanguageServicePlugin, SemanticToken } from '@volar/language-service';
import { forEachElementNode, hyphenateTag } from '@vue/language-core';
import type * as ts from 'typescript';
import { resolveEmbeddedCode } from '../utils';

export function create(
	{ getComponentNames, getElementNames }: import('@vue/typescript-plugin/lib/requests').Requests,
): LanguageServicePlugin {
	return {
		name: 'vue-component-semantic-tokens',
		capabilities: {
			semanticTokensProvider: {
				legend: {
					tokenTypes: ['component'],
					tokenModifiers: [],
				},
			},
		},
		create(context) {
			return {
				async provideDocumentSemanticTokens(document, range, legend) {
					const info = resolveEmbeddedCode(context, document.uri);
					if (info?.code.id !== 'template') {
						return;
					}

					const { template } = info.root.sfc;
					if (!template?.ast) {
						return;
					}

					const componentSpans: ts.TextSpan[] = [];
					const start = document.offsetAt(range.start);
					const end = document.offsetAt(range.end);

					const validComponentNames = await getComponentNames(info.root.fileName) ?? [];
					const elements = new Set(await getElementNames(info.root.fileName) ?? []);
					const components = new Set([
						...validComponentNames,
						...validComponentNames.map(hyphenateTag),
					]);

					for (const node of forEachElementNode(template.ast)) {
						if (
							node.loc.end.offset <= start
							|| node.loc.start.offset >= end
						) {
							continue;
						}
						if (components.has(node.tag) && !elements.has(node.tag)) {
							let start = node.loc.start.offset;
							if (template.lang === 'html') {
								start += '<'.length;
							}
							componentSpans.push({
								start,
								length: node.tag.length,
							});
							if (template.lang === 'html' && !node.isSelfClosing) {
								componentSpans.push({
									start: node.loc.start.offset + node.loc.source.lastIndexOf(node.tag),
									length: node.tag.length,
								});
							}
						}
					}

					const result: SemanticToken[] = [];
					const tokenType = legend.tokenTypes.indexOf('component');

					for (const span of componentSpans) {
						const position = document.positionAt(span.start);
						result.push([
							position.line,
							position.character,
							span.length,
							tokenType,
							0,
						]);
					}

					return result;
				},
			};
		},
	};
}
