import * as kit from '@volar/kit';
import { createVueLanguagePlugin, getDefaultCompilerOptions } from '@vue/language-core';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';
import type { URI } from 'vscode-uri';
import { createVueLanguageServicePlugins } from '../..';

const resolvedVueOptions = getDefaultCompilerOptions();
const vueLanguagePlugin = createVueLanguagePlugin<URI>(
	ts,
	{},
	resolvedVueOptions,
	() => ''
);
const vueServicePLugins = createVueLanguageServicePlugins(ts, undefined);
const formatter = kit.createFormatter([vueLanguagePlugin], vueServicePLugins);

export function defineFormatTest(options: {
	title: string;
	input: string;
	output?: string;
	languageId: string;
	settings?: any;
}) {
	describe(`format: ${options.title}`, () => {

		it(`format`, async () => {

			formatter.settings = options.settings ?? {};

			const formatted = await formatter.format(
				options.input,
				options.languageId,
				{ insertSpaces: false, tabSize: 4 }
			);

			expect(formatted.replace(/\r\n/g, '\n')).toBe((options.output ?? options.input).replace(/\r\n/g, '\n'));
		});
	});
}
