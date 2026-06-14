import type { VueLanguagePlugin } from '../types';
import type { RawIR } from '../virtualCode/rawIr';

const sfcBlockReg = /<(script|style)\b([\s\S]*?)>([\s\S]*?)<\/\1>/g;
const langReg = /\blang\s*=\s*(['"]?)(\S*)\b\1/;

const plugin: VueLanguagePlugin = ({ vueCompilerOptions }) => {
	return {
		version: 3,

		getLanguageId(fileName) {
			if (vueCompilerOptions.petiteVueExtensions.some(ext => fileName.endsWith(ext))) {
				return 'html';
			}
		},

		isValidFile(_fileName, languageId) {
			return languageId === 'html';
		},

		parseSFC(_fileName, languageId, content) {
			if (languageId !== 'html') {
				return;
			}

			const rawIr: RawIR = {
				templates: [],
				scripts: [],
				styles: [],
				customBlocks: [],
				comments: [],
			};

			let templateContent = content;

			for (const match of content.matchAll(sfcBlockReg)) {
				const matchText = match[0];
				const tag = match[1];
				const attrs = match[2]!;
				const lang = attrs.match(langReg)?.[2];
				const content = match[3]!;
				const contentStart = match.index + matchText.indexOf(content);

				if (tag === 'style') {
					rawIr.styles.push({
						name: 'style',
						start: match.index,
						end: match.index + matchText.length,
						innerStart: contentStart,
						innerEnd: contentStart + content.length,
						lang,
						content,
						attrs: {},
					});
				}
				// ignore `<script src="...">`
				else if (tag === 'script' && !attrs.includes('src=')) {
					rawIr.scripts.push({
						name: 'script',
						start: match.index,
						end: match.index + matchText.length,
						innerStart: contentStart,
						innerEnd: contentStart + content.length,
						lang,
						content,
						attrs: {},
					});
				}

				templateContent = templateContent.slice(0, match.index) + ' '.repeat(matchText.length)
					+ templateContent.slice(match.index + matchText.length);
			}

			rawIr.templates.push({
				name: 'template',
				start: 0,
				end: content.length,
				innerStart: 0,
				innerEnd: content.length,
				content: templateContent,
				attrs: {},
			});

			return {
				rawIr,
				errors: [],
				warnings: [],
			};
		},
	};
};

export default plugin;
