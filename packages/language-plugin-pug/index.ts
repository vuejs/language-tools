import { SourceMap } from '@volar/source-map';
import type * as CompilerDOM from '@vue/compiler-dom';
import type { VueIRPlugin } from '@vue/language-core';
import { baseParse } from './lib/baseParse';

const classRE = /^class\s*=/;

export const ir: VueIRPlugin = {
	templateCompilers: {
		pug(template, options, { compileTemplate, getPugTemplatePrefix }) {
			const prefix = getPugTemplatePrefix(template);
			const parsed = baseParse(prefix + template);
			const baseOffset = prefix.length;
			if (prefix) {
				parsed.htmlCode = ' '.repeat('<template>'.length)
					+ parsed.htmlCode.slice('<template>'.length, -'</template>'.length)
					+ ' '.repeat('</template>'.length);
			}

			const map = new SourceMap(parsed.mappings);
			let ast = compileTemplate(parsed.htmlCode, {
				...options,
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
						&& classRE.test(parsed.htmlCode.slice(error.loc?.start.offset))
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
		},
	},
};
