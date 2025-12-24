import { SourceMap } from '@volar/source-map';
import type * as CompilerDOM from '@vue/compiler-dom';
import type { VueLanguagePlugin } from '@vue/language-core';
import * as pug from 'volar-service-pug/lib/languageService';

const classRegex = /^class\s*=/;

const plugin: VueLanguagePlugin = ({ modules }) => {
	const CompilerDOM = modules['@vue/compiler-dom'];

	return {
		name: require('./package.json').name,

		version: 2.2,

		getEmbeddedCodes(_fileName, sfc) {
			if (sfc.template?.lang === 'pug') {
				return [{
					id: 'template',
					lang: sfc.template.lang,
				}];
			}
			return [];
		},

		resolveEmbeddedCode(_fileName, sfc, embeddedFile) {
			if (embeddedFile.id === 'template' && sfc.template?.lang === 'pug') {
				const minIndent = calculateMinIndent(sfc.template.content);
				if (minIndent !== 0) {
					embeddedFile.content.push(`template\n`);
				}
				embeddedFile.content.push([
					sfc.template.content,
					sfc.template.name,
					0,
					{
						verification: true,
						completion: true,
						semantic: true,
						navigation: true,
						structure: true,
						format: true,
					},
				]);
			}
		},

		compileSFCTemplate(lang, template, options) {
			if (lang === 'pug') {
				let parsed: ReturnType<typeof pug.baseParse>;
				let baseOffset = 0;

				const minIndent = calculateMinIndent(template);
				if (minIndent === 0) {
					parsed = pug.baseParse(template);
				}
				else {
					parsed = pug.baseParse(`template\n${template}`);
					baseOffset = 'template\n'.length;
					parsed.htmlCode = ' '.repeat('<template>'.length)
						+ parsed.htmlCode.slice('<template>'.length, -'</template>'.length)
						+ ' '.repeat('</template>'.length);
				}

				const map = new SourceMap(parsed.mappings);
				let ast = CompilerDOM.parse(parsed.htmlCode, {
					...options,
					comments: true,
					onWarn(warning) {
						if (warning.loc) {
							warning.loc.start.offset = toPugOffset(warning.loc.start.offset);
							warning.loc.end.offset = toPugOffset(warning.loc.end.offset);
						}
						options.onWarn?.(warning);
					},
					onError(error) {
						// #5099
						if (
							error.code === 2 satisfies CompilerDOM.ErrorCodes.DUPLICATE_ATTRIBUTE
							&& classRegex.test(parsed.htmlCode.slice(error.loc?.start.offset))
						) {
							return;
						}
						if (error.loc) {
							error.loc.start.offset = toPugOffset(error.loc.start.offset);
							error.loc.end.offset = toPugOffset(error.loc.end.offset);
						}
						options.onError?.(error);
					},
				});
				CompilerDOM.transform(ast, options);

				const visited = new Set<object>();
				visit(ast);

				return {
					ast,
					code: '',
					preamble: '',
				};

				function visit(obj: object) {
					for (const key in obj) {
						const value = (obj as any)[key];
						if (value && typeof value === 'object') {
							if (visited.has(value)) {
								continue;
							}
							visited.add(value);
							if ('offset' in value && typeof value.offset === 'number') {
								const originalOffset = value.offset;
								value.offset = toPugOffset(originalOffset);
							}
							visit(value);
						}
					}
				}

				function toPugOffset(htmlOffset: number) {
					const nums: number[] = [];
					for (const mapped of map.toSourceLocation(htmlOffset)) {
						nums.push(mapped[0] - baseOffset);
					}
					return Math.max(-1, ...nums);
				}
			}
		},
	};
};
export = plugin;

function calculateMinIndent(s: string) {
	const lines = s.split('\n');
	const minIndent = lines.reduce(function(minIndent, line) {
		if (line.trim() === '') {
			return minIndent;
		}
		const indent = line.match(/^\s*/)?.[0]?.length || 0;
		return Math.min(indent, minIndent);
	}, Infinity);
	return minIndent;
}
