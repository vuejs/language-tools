import type * as CompilerDOM from '@vue/compiler-dom';
import type { VueIRPlugin } from '@vue/language-core';
import { compile } from 'muggle-pug';

const classRE = /^class\s*=/;

export const ir: VueIRPlugin = {
	templateCompilers: {
		pug: template => ({
			pieces: compile(template).pieces,
			// #5099: a class literal and a class attribute are two class attributes of the HTML
			ignoreError: (error, html) =>
				error.code === 2 satisfies CompilerDOM.ErrorCodes.DUPLICATE_ATTRIBUTE
				&& classRE.test(html.slice(error.loc?.start.offset)),
		}),
	},
};
