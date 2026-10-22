import type { LanguageServiceContext, SourceScript } from '@volar/language-service';
import { forEachElementNode, type IRTemplate, type VueVirtualCode } from '@vue/language-core';
import { URI } from 'vscode-uri';
import type { TextEdit } from './requests';

/**
 * Places the TypeScript import edits for an SFC whose script has no content: the position TypeScript
 * picks maps to nothing in the SFC, so the imports go into a new `<script setup>` or the empty block.
 */
export function placeScriptImportEdits(root: VueVirtualCode, edits: readonly TextEdit[] | null | undefined) {
	const descriptor = root.vueSfc?.descriptor;
	if (!edits?.length || !descriptor) {
		return edits;
	}
	const imports = edits.map(edit => edit.newText.trim()).filter(Boolean).join('\n');
	const block = descriptor.scriptSetup ?? descriptor.script;
	if (!block) {
		return [{ pos: 0, end: 0, newText: `<script setup lang="ts">\n${imports}\n</script>\n\n` }];
	}
	if (!block.content.trim()) {
		const pos = block.loc.start.offset;
		return [{ pos, end: pos, newText: `\n${imports}${/^\r?\n/.test(block.content) ? '' : '\n'}` }];
	}
	return edits;
}

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
