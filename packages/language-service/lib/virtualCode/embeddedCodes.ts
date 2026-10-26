import {
	buildMappings,
	codeToString,
	type IR,
	type IScriptSnapshot,
	type Mapping,
	resolveCodeOffsets,
	type TextChangeRange,
	type TypeScript,
	type VirtualCode,
} from '@vue/language-core';
import { computed } from 'alien-signals';
import { getCustomBlockDocuments } from './customBlocks';
import type { EmbeddedDocument } from './embeddedDocument';
import { getTemplateInlineCssDocument } from './inlineCss';
import { getTemplateInlineTsDocuments } from './inlineTs';
import { getRootTagsDocument } from './rootTags';
import { getScriptDocuments } from './scripts';
import { getStyleDocuments } from './styles';
import { getTemplateDocument } from './template';

interface ResolvedDocument {
	id: string;
	languageId: string;
	snapshot: IScriptSnapshot;
	mappings: Mapping[];
	children: ResolvedDocument[];
}

/**
 * The embedded documents of a file for the language service, like the template or a style block. They never reach
 * TypeScript: the TypeScript code of a file is generated from its IR alone.
 *
 * `root_tags` holds the document of each block. The template document holds the inline CSS and TypeScript of the
 * template, which `root_tags` holds instead for a markdown template, and which are top-level for a template
 * language that has no template document.
 */
export function useEmbeddedCodes(ts: TypeScript, ir: IR) {
	const getRootTags = useDocuments(ir, () => [getRootTagsDocument(ir)]);
	const getTemplateInlineCss = useDocuments(ir, () => optional(getTemplateInlineCssDocument(ir)));
	const getTemplateInlineTs = useDocuments(ir, () => getTemplateInlineTsDocuments(ts, ir));
	const getStyles = useDocuments(ir, () => getStyleDocuments(ir));
	const getCustomBlocks = useDocuments(ir, () => getCustomBlockDocuments(ir));
	const getScripts = useDocuments(ir, () => getScriptDocuments(ir));
	const getTemplate = useDocuments(ir, () => optional(getTemplateDocument(ir)));
	const isMarkdownTemplate = computed(() => ir.template?.lang === 'md');

	return computed(() => {
		const [rootTags] = getRootTags();
		const [template] = getTemplate();
		const templateInlineCodes = [...getTemplateInlineCss(), ...getTemplateInlineTs()].map(toVirtualCode);
		const blockCodes = [...getStyles(), ...getCustomBlocks(), ...getScripts()].map(toVirtualCode);
		const result: VirtualCode[] = [toVirtualCode(rootTags!)];

		if (isMarkdownTemplate()) {
			result[0]!.embeddedCodes!.push(...templateInlineCodes);
		}
		if (template) {
			const templateCode = toVirtualCode(template);
			if (!isMarkdownTemplate()) {
				templateCode.embeddedCodes!.push(...templateInlineCodes);
			}
			blockCodes.push(templateCode);
		}
		else if (!isMarkdownTemplate()) {
			result.push(...templateInlineCodes);
		}
		result[0]!.embeddedCodes!.push(...blockCodes);

		return result;
	});
}

function optional<T>(value: T | undefined) {
	return value ? [value] : [];
}

function toVirtualCode({ id, languageId, snapshot, mappings, children }: ResolvedDocument): VirtualCode {
	return {
		id,
		languageId,
		snapshot,
		mappings,
		embeddedCodes: children.map(toVirtualCode),
	};
}

/** The documents of `getDocuments`, keeping the snapshot of a document whose text is unchanged. */
function useDocuments(ir: IR, getDocuments: () => EmbeddedDocument[]) {
	return computed<ResolvedDocument[]>(previous => {
		let documents: EmbeddedDocument[];
		try {
			documents = getDocuments();
		}
		catch (e) {
			console.error(e);
			documents = [];
		}
		return resolveDocuments(documents, previous);
	});

	function resolveDocuments(documents: EmbeddedDocument[], previous: ResolvedDocument[] | undefined) {
		return documents.map(({ id, lang, content, children = [] }): ResolvedDocument => {
			const text = codeToString(content);
			const languageId = resolveCommonLanguageId(lang);
			const old = previous?.find(document => document.id === id && document.languageId === languageId);
			return {
				id,
				languageId,
				snapshot: old && old.snapshot.getText(0, old.snapshot.getLength()) === text
					? old.snapshot
					: createSnapshot(text),
				mappings: buildMappings(resolveCodeOffsets(ir, content)),
				children: resolveDocuments(children, old?.children),
			};
		});
	}
}

function createSnapshot(newText: string): IScriptSnapshot {
	const changeRanges = new Map<IScriptSnapshot, TextChangeRange | undefined>();
	return {
		getText: (start, end) => newText.slice(start, end),
		getLength: () => newText.length,
		getChangeRange(oldSnapshot) {
			if (!changeRanges.has(oldSnapshot)) {
				changeRanges.set(oldSnapshot, undefined);
				const oldText = oldSnapshot.getText(0, oldSnapshot.getLength());
				const changeRange = fullDiffTextChangeRange(oldText, newText);
				if (changeRange) {
					changeRanges.set(oldSnapshot, changeRange);
				}
			}
			return changeRanges.get(oldSnapshot);
		},
	};
}

function fullDiffTextChangeRange(oldText: string, newText: string): TextChangeRange | undefined {
	for (let start = 0; start < oldText.length && start < newText.length; start++) {
		if (oldText[start] !== newText[start]) {
			let end = oldText.length;
			for (let i = 0; i < oldText.length - start && i < newText.length - start; i++) {
				if (oldText[oldText.length - i - 1] !== newText[newText.length - i - 1]) {
					break;
				}
				end--;
			}
			let length = end - start;
			let newLength = length + (newText.length - oldText.length);
			if (newLength < 0) {
				length -= newLength;
				newLength = 0;
			}
			return {
				span: { start, length },
				newLength,
			};
		}
	}
}

function resolveCommonLanguageId(lang: string) {
	switch (lang) {
		case 'js':
			return 'javascript';
		case 'cjs':
			return 'javascript';
		case 'mjs':
			return 'javascript';
		case 'ts':
			return 'typescript';
		case 'cts':
			return 'typescript';
		case 'mts':
			return 'typescript';
		case 'jsx':
			return 'javascriptreact';
		case 'tsx':
			return 'typescriptreact';
		case 'pug':
			return 'jade';
		case 'md':
			return 'markdown';
	}
	return lang;
}
