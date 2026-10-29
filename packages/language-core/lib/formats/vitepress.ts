import type { VueFormat } from '../types';
import { parse } from './parseSfc';

const frontmatterRE = /^---[\s\S]*?\n---(?:\r?\n|$)/;
const codeblockRE = /(`{3}|\${2})[\s\S]+?\1/g;
const codeSnippetImportRE = /^\s*<<<\s*.+/gm;
const sfcBlockRE = /<(script|style)\b[^>]*>([\s\S]*?)<\/\1>/g;
const htmlTagRE = /(?<=<\/?)([a-z][a-z0-9-]*)\b[^>]*(?=>)/gi;
const interpolationRE = /(?<=\{\{)[\s\S]*?(?=\}\})/g;
const inlineCodeRE = /(`{1,2})[^`\n]+\1/g;
const angleBracketRE = /<[^\s:]*:\S*>/g;

/**
 * Treats a file as VitePress markdown: frontmatter, fenced code blocks and code snippet imports
 * are blanked, `<script>` / `<style>` blocks are lifted out of the template, and the remaining
 * markdown becomes the template, over the whole file.
 */
export const vitePressParser: VueFormat = {
	parse(_fileName, content) {
		for (const pattern of [frontmatterRE, codeblockRE, codeSnippetImportRE]) {
			content = content.replace(pattern, match => ' '.repeat(match.length));
		}

		const ambiguousRanges: [number, number][] = [];
		for (const pattern of [inlineCodeRE, angleBracketRE]) {
			for (const { 0: text, index } of content.matchAll(pattern)) {
				ambiguousRanges.push([index, index + text.length]);
			}
		}

		const semanticRanges: [number, number][] = [];
		for (const pattern of [htmlTagRE, interpolationRE]) {
			for (const { 0: text, index } of content.matchAll(pattern)) {
				semanticRanges.push([index, index + text.length]);
			}
		}

		// The `<script>` / `<style>` blocks at their offsets, with the rest of the file blanked, read as an SFC
		let blocksText = ' '.repeat(content.length);

		for (const { 0: text, index } of content.matchAll(sfcBlockRE)) {
			if (ambiguousRanges.some(([start, end]) => index >= start && index < end)) {
				continue;
			}
			blocksText = blocksText.slice(0, index) + text + blocksText.slice(index + text.length);
			content = content.slice(0, index) + ' '.repeat(text.length) + content.slice(index + text.length);
		}

		for (const [start, end] of ambiguousRanges) {
			if (semanticRanges.some(range => start >= range[0] && end <= range[1])) {
				continue;
			}
			content = content.slice(0, start) + ' '.repeat(end - start) + content.slice(end);
		}

		const sfc = parse(blocksText);
		sfc.template = { content, offset: 0, lang: 'html', attrs: {} };
		return sfc;
	},
};
