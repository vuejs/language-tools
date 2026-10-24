import {
	createLanguage,
	createLanguageService,
	createUriMap,
	type FormattingOptions,
	type LanguagePlugin,
	type LanguageServicePlugin,
} from '@volar/language-service';
import { createVueLanguagePlugin, getDefaultCompilerOptions } from '@vue/language-core';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { URI } from 'vscode-uri';
import { createVueLanguageServicePlugins } from '../..';
import { asCoreTypeScript } from '../../lib/utils';
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
		const snapshot = ts.ScriptSnapshot.fromString(content);
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
	asCoreTypeScript(ts),
	resolvedVueOptions,
	() => '',
);
const vueLanguagePlugin: typeof vuePlugin = {
	...vuePlugin,
	createVirtualCode: (uri, languageId, snapshot, ctx) =>
		languageId === 'vue' ? vuePlugin.createVirtualCode!(uri, languageId, snapshot, ctx) : undefined,
};
const vueServicePLugins = createVueLanguageServicePlugins(ts);
const formatter = createFormatter([vueLanguagePlugin], vueServicePLugins);

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
				{ insertSpaces: false, tabSize: 4 },
			);

			expect(formatted.replace(/\r\n/g, '\n')).toBe((options.output ?? options.input).replace(/\r\n/g, '\n'));
		});
	});
}
