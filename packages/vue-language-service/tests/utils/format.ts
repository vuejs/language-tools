import { describe, expect, it } from 'vitest';
import * as kit from '@volar/kit';
import { resolveConfig } from '../../src';

const formatter = kit.createFormatter(resolveConfig({}));

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

			const formatted = await formatter.formatCode(
				options.input,
				options.languageId,
				{ insertSpaces: false, tabSize: 4 },
			);

			expect(formatted).toBe((options.output ?? options.input));
		});
	});
}
