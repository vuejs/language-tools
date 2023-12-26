import * as kit from '@volar/kit';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { resolveLanguages, resolveServices, resolveVueCompilerOptions } from '../../out';

const resolvedVueOptions = resolveVueCompilerOptions({});
const languages = resolveLanguages({}, ts, {}, resolvedVueOptions);
const services = resolveServices({}, ts, () => resolvedVueOptions);
const formatter = kit.createFormatter(Object.values(languages), Object.values(services));

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

			expect(formatted).toBe((options.output ?? options.input));
		});
	});
}
