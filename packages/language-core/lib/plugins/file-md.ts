import { SourceMap } from '@volar/language-core';
import { type Segment, toString } from 'muggle-string';
import type { VueLanguagePlugin } from '../types';
import { buildMappings } from '../utils/buildMappings';
import { parseRawIR, type RawIRBlock } from '../virtualCode/rawIr';

const frontmatterReg = /^---[\s\S]*?\n---(?:\r?\n|$)/;
const codeblockReg = /(`{3}|\${2})[\s\S]+?\1/g;
const codeSnippetImportReg = /^\s*<<<\s*.+/gm;
const sfcBlockReg = /<(script|style)\b[^>]*>([\s\S]*?)<\/\1>/g;
const htmlTagReg = /(?<=<\/?)([a-z][a-z0-9-]*)\b[^>]*(?=>)/gi;
const interpolationReg = /(?<=\{\{)[\s\S]*?(?=\}\})/g;
const inlineCodeReg = /(`{1,2})[^`]+\1/g;
const angleBracketReg = /<[^\s:]*:\S*>/g;

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

		parseSFC(_fileName, languageId, content) {
			if (languageId !== 'markdown') {
				return;
			}

			for (const reg of [frontmatterReg, codeblockReg, codeSnippetImportReg]) {
				content = content.replace(reg, match => ' '.repeat(match.length));
			}

			const codes: Segment[] = [];

			for (const { 0: text, index } of content.matchAll(sfcBlockReg)) {
				codes.push([text, undefined, index]);
				codes.push('\n\n');
				content = content.slice(0, index) + ' '.repeat(text.length) + content.slice(index + text.length);
			}

			const ranges: [number, number][] = [];
			for (const reg of [htmlTagReg, interpolationReg]) {
				for (const { 0: text, index } of content.matchAll(reg)) {
					ranges.push([index, index + text.length]);
				}
			}

			for (const reg of [inlineCodeReg, angleBracketReg]) {
				for (const { 0: text, index } of content.matchAll(reg)) {
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
			const { rawIr, errors, warnings } = parseRawIR(toString(codes));

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
