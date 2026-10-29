import {
	createLanguage,
	createLanguageService,
	createUriMap,
	type FormattingOptions,
	type LanguagePlugin,
	type LanguageServicePlugin,
} from '@volar/language-service';
import { stringToSnapshot } from '@volar/language-service/lib/utils/common';
import { getDefaultCompilerOptions } from '@vue/language-core';
import { loadTypeScript } from '@vue/language-core/typescript';
import { describe, expect, it } from 'vitest';
import { URI } from 'vscode-uri';
import { createVueLanguagePlugin, createVueLanguageServicePlugins } from '../..';
import { createTestEnvironment } from './environment';

function createFormatter(
	languages: LanguagePlugin<URI>[],
	services: LanguageServicePlugin[],
) {
	let settings = {};

	const fakeUri = URI.parse('file:///dummy.txt');
	const env = createTestEnvironment(() => settings);
	const language = createLanguage(languages, createUriMap(false), () => {});
	const languageService = createLanguageService(language, services, env, {});

	return {
		format,
		get settings() {
			return settings;
		},
		set settings(v) {
			settings = v;
		},
	};

	async function format(content: string, languageId: string, options: FormattingOptions): Promise<string> {
		const snapshot = stringToSnapshot(content);
		language.scripts.set(fakeUri, snapshot, languageId);
		const document = languageService.context.documents.get(fakeUri, languageId, snapshot);
		const edits = await languageService.getDocumentFormattingEdits(fakeUri, options, undefined, undefined);
		if (!edits?.length) {
			return content;
		}
		const text = document.getText();
		const sorted = edits
			.map(edit => ({ start: document.offsetAt(edit.range.start), end: document.offsetAt(edit.range.end), edit }))
			.sort((a, b) => a.start - b.start);
		let result = '';
		let lastOffset = 0;
		for (const { start, end, edit } of sorted) {
			result += text.slice(lastOffset, start) + edit.newText;
			lastOffset = end;
		}
		return result + text.slice(lastOffset);
	}
}

const resolvedVueOptions = getDefaultCompilerOptions();
const vuePlugin = createVueLanguagePlugin<URI>(
	loadTypeScript(),
	resolvedVueOptions,
	() => '',
);
const vueLanguagePlugin: typeof vuePlugin = {
	...vuePlugin,
	createVirtualCode: (uri, languageId, snapshot, ctx) =>
		languageId === 'vue' ? vuePlugin.createVirtualCode!(uri, languageId, snapshot, ctx) : undefined,
};
const vueServicePLugins = createVueLanguageServicePlugins();
const formatter = createFormatter([vueLanguagePlugin], vueServicePLugins);

export function defineFormatTest(options: {
	title: string;
	input: string;
	output?: string;
	languageId: string;
	settings?: any;
	/**
	 * The output needs the TypeScript formatter of script blocks and template expressions, which waits on the
	 * project-free syntactic API of TypeScript 7.1 `typescript/sync`, so the test fails until that API is used.
	 */
	formatsTypeScript?: boolean;
}) {
	describe(`format: ${options.title}`, () => {
		(options.formatsTypeScript ? it.fails : it)(`format`, async () => {
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
