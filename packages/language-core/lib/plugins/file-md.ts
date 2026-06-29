import { SourceMap } from '@volar/language-core';
import type { SFCBlock } from '@vue/compiler-sfc';
import { type Segment, toString } from 'muggle-string';
import type { VueLanguagePlugin } from '../types';
import { buildMappings } from '../utils/buildMappings';
import { parse } from '../utils/parseSfc';

const frontmatterRE = /^---[\s\S]*?\n---(?:\r?\n|$)/;
const codeblockRE = /(`{3}|\${2})[\s\S]+?\1/g;
const codeSnippetImportRE = /^\s*<<<\s*.+/gm;
const sfcBlockRE = /<(script|style)\b[^>]*>([\s\S]*?)<\/\1>/g;
const htmlTagRE = /(?<=<\/?)([a-z][a-z0-9-]*)\b[^>]*(?=>)/gi;
const interpolationRE = /(?<=\{\{)[\s\S]*?(?=\}\})/g;
const inlineCodeRE = /(`{1,2})[^`]+\1/g;
const angleBracketRE = /<[^\s:]*:\S*>/g;

const plugin: VueLanguagePlugin = ({ vueCompilerOptions }) => {
	return {
		version: 2.2,

		getLanguageId(fileName) {
			if (vueCompilerOptions.vitePressExtensions.some(ext => fileName.endsWith(ext))) {
				return 'markdown';
			}
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

			const codes: Segment[] = [];

			for (const { 0: text, index } of content.matchAll(sfcBlockRE)) {
				codes.push([text, undefined, index]);
				codes.push('\n\n');
				content = content.slice(0, index) + ' '.repeat(text.length) + content.slice(index + text.length);
			}

			const ranges: [number, number][] = [];
			for (const pattern of [htmlTagRE, interpolationRE]) {
				for (const { 0: text, index } of content.matchAll(pattern)) {
					ranges.push([index, index + text.length]);
				}
			}

			for (const pattern of [inlineCodeRE, angleBracketRE]) {
				for (const { 0: text, index } of content.matchAll(pattern)) {
					if (ranges.some(([start, end]) => index >= start && index < end)) {
						continue;
					}
					content = content.slice(0, index) + ' '.repeat(text.length) + content.slice(index + text.length);
				}
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

export default plugin;
