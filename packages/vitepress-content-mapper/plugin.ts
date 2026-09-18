import { SourceMap } from '@volar/language-core';
import type { SFCBlock } from '@vue/compiler-sfc';
import { buildMappings, parse, type VueLanguagePlugin } from '@vue/language-core';
import { type Segment, toString } from 'muggle-string';

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
 * markdown becomes the template. The SFC block offsets are mapped back to the markdown source, so
 * everything downstream stays in original file coordinates.
 *
 * Which files reach this plugin is decided by the mapper registration (`contentMappers[].extensions`),
 * not by a Vue compiler option, so the plugin claims every file it is asked for.
 */
export const markdownPlugin: VueLanguagePlugin = () => {
	return {
		version: 2.2,

		getLanguageId() {
			return 'markdown';
		},

		isValidFile(_fileName, languageId) {
			return languageId === 'markdown';
		},

		parseSFC2(_fileName, languageId, content) {
			if (languageId !== 'markdown') {
				return;
			}

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

			const codes: Segment[] = [];

			for (const { 0: text, index } of content.matchAll(sfcBlockRE)) {
				if (ambiguousRanges.some(([start, end]) => index >= start && index < end)) {
					continue;
				}
				codes.push([text, undefined, index]);
				codes.push('\n\n');
				content = content.slice(0, index) + ' '.repeat(text.length) + content.slice(index + text.length);
			}

			for (const [start, end] of ambiguousRanges) {
				if (semanticRanges.some(range => start >= range[0] && end <= range[1])) {
					continue;
				}
				content = content.slice(0, start) + ' '.repeat(end - start) + content.slice(end);
			}

			codes.push('<template>\n');
			codes.push([content, undefined, 0]);
			codes.push('\n</template>');

			const mappings = buildMappings(codes);
			const mapper = new SourceMap(mappings);
			const sfc = parse(toString(codes));

			for (
				const block of [
					sfc.descriptor.template,
					sfc.descriptor.script,
					sfc.descriptor.scriptSetup,
					...sfc.descriptor.styles,
					...sfc.descriptor.customBlocks,
				]
			) {
				if (block) {
					transformRange(block);
				}
			}

			return sfc;

			function transformRange(block: SFCBlock) {
				const { start, end } = block.loc;
				const startOffset = start.offset;
				const endOffset = end.offset;
				start.offset = -1;
				end.offset = -1;
				for (const [offset] of mapper.toSourceLocation(startOffset)) {
					start.offset = offset;
					break;
				}
				for (const [offset] of mapper.toSourceLocation(endOffset)) {
					end.offset = offset;
					break;
				}
			}
		},
	};
};
