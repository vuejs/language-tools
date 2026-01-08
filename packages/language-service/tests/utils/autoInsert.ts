import { createServiceEnvironment } from '@volar/kit/lib/createServiceEnvironment';
import {
	createLanguage,
	createLanguageService,
	createUriMap,
	type LanguagePlugin,
	type LanguageServicePlugin,
} from '@volar/language-service';
import { createVueLanguagePlugin, getDefaultCompilerOptions } from '@vue/language-core';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { URI } from 'vscode-uri';
import { createVueLanguageServicePlugins } from '../..';

// TODO: migrate to @volar/kit
export function createAutoInserter(
	languages: LanguagePlugin<URI>[],
	services: LanguageServicePlugin[],
) {
	let settings = {};

	const fakeUri = URI.parse('file:///dummy.txt');
	const env = createServiceEnvironment(() => settings);
	const language = createLanguage(languages, createUriMap(false), () => {});
	const languageService = createLanguageService(language, services, env, {});

	return {
		env,
		autoInsert,
		get settings() {
			return settings;
		},
		set settings(v) {
			settings = v;
		},
	};

	async function autoInsert(textWithCursor: string, insertedText: string, languageId: string, cursor = '|') {
		const cursorIndex = textWithCursor.indexOf(cursor);
		if (cursorIndex === -1) {
			throw new Error('Cursor marker not found in input text.');
		}
		const content = textWithCursor.slice(0, cursorIndex) + insertedText
			+ textWithCursor.slice(cursorIndex + cursor.length);
		const snapshot = ts.ScriptSnapshot.fromString(content);
		language.scripts.set(fakeUri, snapshot, languageId);
		const document = languageService.context.documents.get(fakeUri, languageId, snapshot);
		return await languageService.getAutoInsertSnippet(
			fakeUri,
			document.positionAt(cursorIndex + insertedText.length),
			{
				rangeOffset: cursorIndex,
				rangeLength: 0,
				text: insertedText,
			},
		);
	}
}

// util

const vueCompilerOptions = getDefaultCompilerOptions();
const vueLanguagePlugin = createVueLanguagePlugin<URI>(
	ts,
	{},
	vueCompilerOptions,
	() => '',
);
const vueServicePLugins = createVueLanguageServicePlugins(ts);
const autoInserter = createAutoInserter([vueLanguagePlugin], vueServicePLugins);

export function defineAutoInsertTest(options: {
	title: string;
	input: string;
	insertedText: string;
	output: string | undefined;
	languageId: string;
	cursor?: string;
}) {
	describe(`auto insert: ${options.title}`, () => {
		it(`auto insert`, async () => {
			const snippet = await autoInserter.autoInsert(
				options.input,
				options.insertedText,
				options.languageId,
				options.cursor,
			);
			expect(snippet).toBe(options.output);
		});
	});
}
