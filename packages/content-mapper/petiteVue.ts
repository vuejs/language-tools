import type { SFCParseResult } from '@vue/compiler-sfc';
import type { VueLanguagePlugin } from '@vue/language-core';

const sfcBlockRE = /<(script|style)\b([\s\S]*?)>([\s\S]*?)<\/\1>/g;
const langRE = /\blang\s*=\s*(['"]?)(\S*)\b\1/;

/**
 * Treats a file as a petite-vue HTML page: `<script>` / `<style>` blocks are lifted out and the
 * rest of the page becomes the template. A `<script>` with a `type` attribute (e.g.
 * `type="module"`) is treated as `<script setup>`; `<script src="...">` is ignored.
 *
 * It is selected by the mapper entry's `format: "petite-vue"`, not by file extension, so the plugin
 * claims every file it is asked for.
 */
export const petiteVuePlugin: VueLanguagePlugin = () => {
	return {
		version: 2.2,

		getLanguageId() {
			return 'html';
		},

		isValidFile(_fileName, languageId) {
			return languageId === 'html';
		},

		parseSFC2(fileName, languageId, content) {
			if (languageId !== 'html') {
				return;
			}

			const sfc: SFCParseResult = {
				descriptor: {
					filename: fileName,
					source: content,
					comments: [],
					template: null,
					script: null,
					scriptSetup: null,
					styles: [],
					customBlocks: [],
					cssVars: [],
					shouldForceReload: () => false,
					slotted: false,
				},
				errors: [],
			};

			let templateContent = content;

			for (const match of content.matchAll(sfcBlockRE)) {
				const matchText = match[0];
				const tag = match[1];
				const attrs = match[2]!;
				const lang = attrs.match(langRE)?.[2];
				const blockContent = match[3]!;
				const contentStart = match.index + matchText.indexOf(blockContent);
				const loc = {
					start: { column: -1, line: -1, offset: contentStart },
					end: { column: -1, line: -1, offset: contentStart + blockContent.length },
					source: blockContent,
				};

				if (tag === 'style') {
					sfc.descriptor.styles.push({ attrs: {}, content: blockContent, loc, type: 'style', lang });
				}
				else if (tag === 'script' && !attrs.includes('src=')) {
					const type = attrs.includes('type=') ? 'scriptSetup' : 'script';
					sfc.descriptor[type] = { attrs: {}, content: blockContent, loc, type: 'script', lang };
				}

				templateContent = templateContent.slice(0, match.index) + ' '.repeat(matchText.length)
					+ templateContent.slice(match.index + matchText.length);
			}

			sfc.descriptor.template = {
				attrs: {},
				content: templateContent,
				loc: {
					start: { column: -1, line: -1, offset: 0 },
					end: { column: -1, line: -1, offset: templateContent.length },
					source: templateContent,
				},
				type: 'template',
				ast: {} as any,
			};

			return sfc;
		},
	};
};
