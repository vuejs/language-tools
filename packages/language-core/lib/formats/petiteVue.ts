import type { VueFormat, VueFormatBlock, VueFormatResult } from '../types';

const sfcBlockRE = /<(script|style)\b([\s\S]*?)>([\s\S]*?)<\/\1>/g;
const langRE = /\blang\s*=\s*(['"]?)(\S*)\b\1/;

/**
 * Treats a file as a petite-vue HTML page: `<script>` / `<style>` blocks are lifted out and the
 * rest of the page becomes the template, a block without tags over the whole file. A `<script>` with
 * a `type` attribute (e.g. `type="module"`) is treated as `<script setup>`; `<script src="...">` is ignored.
 */
export const petiteVueParser: VueFormat = {
	parse(_fileName, content) {
		const result: VueFormatResult = {
			comments: [],
			errors: [],
			template: undefined,
			script: undefined,
			scriptSetup: undefined,
			styles: [],
			customBlocks: [],
		};

		let templateContent = content;

		for (const match of content.matchAll(sfcBlockRE)) {
			const matchText = match[0];
			const tag = match[1]!;
			const attrs = match[2]!;
			const blockContent = match[3]!;
			const startTagEnd = match.index + `<${tag}${attrs}>`.length;
			const block: VueFormatBlock = {
				start: match.index,
				end: match.index + matchText.length,
				startTagEnd,
				endTagStart: startTagEnd + blockContent.length,
				lang: attrs.match(langRE)?.[2],
				content: blockContent,
				attrs: {},
			};

			if (tag === 'style') {
				result.styles.push(block);
			}
			else if (tag === 'script' && !attrs.includes('src=')) {
				result[attrs.includes('type=') ? 'scriptSetup' : 'script'] = block;
			}

			templateContent = templateContent.slice(0, match.index) + ' '.repeat(matchText.length)
				+ templateContent.slice(match.index + matchText.length);
		}

		result.template = {
			start: 0,
			end: templateContent.length,
			startTagEnd: 0,
			endTagStart: templateContent.length,
			content: templateContent,
			attrs: {},
		};

		return result;
	},
};
