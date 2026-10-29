import { SourceMap } from '@volar/language-core';
import { type Segment, toString } from 'muggle-string';
import type { VueLanguagePlugin } from '../types';
import { buildMappings } from '../utils/buildMappings';
import { parseRawIR, type RawIRBlock } from '../virtualCode/rawIr';

const frontmatterRE = /^---[\s\S]*?\n---(?:\r?\n|$)/;
const codeblockRE = /(`{3}|\${2})[\s\S]+?\1/g;
const codeSnippetImportRE = /^\s*<<<\s*.+/gm;
const sfcBlockRE = /<(script|style)\b[^>]*>([\s\S]*?)<\/\1>/g;
const htmlTagRE = /(?<=<\/?)([a-z][a-z0-9-]*)\b[^>]*(?=>)/gi;
const interpolationRE = /(?<=\{\{)[\s\S]*?(?=\}\})/g;
const inlineCodeRE = /(`{1,2})[^`\n]+\1/g;
const angleBracketRE = /<[^\s:]*:\S*>/g;

const plugin: VueLanguagePlugin = ({ vueCompilerOptions }) => {
	return {
		version: 3,

		getLanguageId(fileName) {
			if (vueCompilerOptions.vitePressExtensions.some(ext => fileName.endsWith(ext))) {
				return 'markdown';
			}
		},

		isValidFile(_fileName, languageId) {
			return languageId === 'markdown';
		},

		parseSFC(_fileName, languageId, content, options) {
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
			const { rawIr, errors, warnings } = parseRawIR(toString(codes), options);

			for (
				const block of [
					...rawIr.templates,
					...rawIr.scripts,
					...rawIr.styles,
					...rawIr.customBlocks,
				]
			) {
				transformRange(block);
			}

			return {
				rawIr,
				errors,
				warnings,
			};

			function transformRange(block: RawIRBlock) {
				for (const key of ['start', 'end', 'innerStart', 'innerEnd'] as const) {
					const originalValue = block[key];
					block[key] = -1;
					for (const [offset] of mapper.toSourceLocation(originalValue)) {
						block[key] = offset;
						break;
					}
				}
			}
		},
	};
};

export default plugin;
