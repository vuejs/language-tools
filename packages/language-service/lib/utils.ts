import type { LanguageServiceContext, SourceScript } from '@volar/language-service';
import { forEachElementNode, type IRTemplate, type VueVirtualCode } from '@vue/language-core';
import { URI } from 'vscode-uri';

export function resolveEmbeddedCode(
	context: LanguageServiceContext,
	uriStr: string,
) {
	const uri = URI.parse(uriStr);
	const decoded = context.decodeEmbeddedDocumentUri(uri);
	if (!decoded) {
		return;
	}
	const sourceScript = context.language.scripts.get(decoded[0]);
	if (!sourceScript?.generated) {
		return;
	}
	const code = sourceScript.generated.embeddedCodes.get(decoded[1]);
	if (!code) {
		return;
	}
	return {
		script: sourceScript as Required<SourceScript<URI>>,
		code,
		root: sourceScript.generated.root as VueVirtualCode,
	};
}

/** The component tag name, in its start or end tag, that `offset` in the template content touches. */
export function getComponentTagAt(template: IRTemplate, offset: number) {
	if (!template.ast) {
		return;
	}
	for (const node of forEachElementNode(template.ast)) {
		// ElementTypes.COMPONENT
		if (node.tagType !== 1) {
			continue;
		}
		const starts = [node.loc.start.offset + 1];
		if (!node.isSelfClosing && node.loc.source.endsWith(`</${node.tag}>`)) {
			starts.push(node.loc.end.offset - node.tag.length - 1);
		}
		for (const start of starts) {
			if (offset >= start && offset <= start + node.tag.length) {
				return { tag: node.tag, start, end: start + node.tag.length, startTagNameOffset: starts[0]! };
			}
		}
	}
}
