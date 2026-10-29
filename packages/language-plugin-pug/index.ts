import type * as CompilerDOM from '@vue/compiler-dom';
import type { VueIRPlugin } from '@vue/language-core';
import { baseParse } from './lib/baseParse';

const classRE = /^class\s*=/;

export const ir: VueIRPlugin = {
	templateCompilers: {
		pug(template) {
			const { htmlCode: html, mappings } = baseParse(template);
			return {
				html,
				mappings,
				// #5099: a class literal and a class attribute are two class attributes of the HTML
				ignoreError: error =>
					error.code === 2 satisfies CompilerDOM.ErrorCodes.DUPLICATE_ATTRIBUTE
					&& classRE.test(html.slice(error.loc?.start.offset)),
			};
		},
	},
};
