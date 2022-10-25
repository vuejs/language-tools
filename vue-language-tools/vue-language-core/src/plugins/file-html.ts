import type { SFCParseResult } from '@vue/compiler-sfc';
import { VueLanguagePlugin } from '../types';

const plugin: VueLanguagePlugin = () => {

	return {

		version: 1,

		parseSFC(fileName, content) {

			if (fileName.endsWith('.html')) {

				let sfc: SFCParseResult = {
					descriptor: {
						filename: fileName,
						source: content,
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

				const sfcBlockReg = /\<(script|style)\b([\s\S]*?)\>([\s\S]*?)\<\/\1\>/g;
				const langReg = /\blang\s*=\s*(['\"]?)(\S*)\b\1/;

				for (const match of content.matchAll(sfcBlockReg)) {

					const matchText = match[0];
					const tag = match[1];
					const attrs = match[2];
					const lang = attrs.match(langReg)?.[2];
					const content = match[3];
					const contentStart = match.index! + matchText.indexOf(content);

					if (tag === 'style') {
						sfc.descriptor.styles.push({
							attrs: {},
							content,
							loc: {
								start: { column: -1, line: -1, offset: contentStart },
								end: { column: -1, line: -1, offset: contentStart + content.length },
								source: content,
							},
							type: 'style',
							lang,
						});
					}
					// ignore `<script src="...">`
					else if (tag === 'script' && attrs.indexOf('src=') === -1) {
						let type: 'script' | 'scriptSetup' = attrs.indexOf('type=') >= 0 ? 'scriptSetup' : 'script';
						sfc.descriptor[type] = {
							attrs: {},
							content,
							loc: {
								start: { column: -1, line: -1, offset: contentStart },
								end: { column: -1, line: -1, offset: contentStart + content.length },
								source: content,
							},
							type: 'script',
							lang,
						};
					}

					templateContent = templateContent.substring(0, match.index) + ' '.repeat(matchText.length) + templateContent.substring(match.index! + matchText.length);
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
			};
		}
	};
};
export = plugin;
