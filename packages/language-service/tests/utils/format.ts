import * as kit from '@volar/kit';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { resolveLanguages, resolveServices } from '../../out';

const languages = resolveLanguages(ts as any);
const services = resolveServices();

export function defineFormatTest(options: {
	title: string;
	input: string;
	output?: string;
	languageId: string;
	settings?: any;
}) {
	describe(`format: ${options.title}`, async () => {

		it(`format`, async () => {

			const formatter = kit.createFormatter(Object.values(languages), Object.values(services), options.settings);
			const formatted = await formatter.formatCode(
				options.input,
				options.languageId,
				{ insertSpaces: false, tabSize: 4 },
			);

			expect(formatted).toBe((options.output ?? options.input));
		});
	});
}
