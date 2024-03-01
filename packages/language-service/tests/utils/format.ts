import * as kit from '@volar/kit';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { createVueLanguagePlugin, createVueServicePlugins, resolveVueCompilerOptions } from '../..';

const resolvedVueOptions = resolveVueCompilerOptions({});
const vueLanguagePlugin = createVueLanguagePlugin(ts, fileId => formatter.env.typescript!.uriToFileName(fileId), {}, resolvedVueOptions);
const vueServicePLugins = createVueServicePlugins(ts, () => resolvedVueOptions);
const formatter = kit.createFormatter([vueLanguagePlugin], vueServicePLugins);

export function defineFormatTest(options: {
	title: string;
	input: string;
	output?: string;
	languageId: string;
	settings?: any;
}) {
	describe(`format: ${options.title}`, async () => {

		it(`format`, async () => {

			formatter.settings = options.settings ?? {};

			const formatted = await formatter.format(
				options.input,
				options.languageId,
				{ insertSpaces: false, tabSize: 4 },
			);

			expect(formatted.replace(/\r\n/g, '\n')).toBe((options.output ?? options.input).replace(/\r\n/g, '\n'));
		});
	});
}
