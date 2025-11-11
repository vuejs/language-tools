import { createServiceEnvironment } from '@volar/kit/lib/createServiceEnvironment';
import {
	createLanguage,
	createLanguageService,
	createUriMap,
	LanguagePlugin,
	LanguageServicePlugin,
} from '@volar/language-service';
import * as ts from 'typescript';
import { URI } from 'vscode-uri';

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

	async function autoInsert(textWithCursor: string, insertedText: string) {
		const cursorIndex = textWithCursor.indexOf('|');
		if (cursorIndex === -1) {
			throw new Error('Cursor marker not found in input text.');
		}
		const content = textWithCursor.slice(0, cursorIndex) + textWithCursor.slice(cursorIndex + 1);
		const snapshot = ts.ScriptSnapshot.fromString(content);
		language.scripts.set(fakeUri, snapshot, 'vue');
		const document = languageService.context.documents.get(fakeUri, 'vue', snapshot);
		return await languageService.getAutoInsertSnippet(
			fakeUri,
			document.positionAt(cursorIndex),
			{
				rangeOffset: cursorIndex - insertedText.length,
				rangeLength: 0,
				text: insertedText,
			},
		);
	}
}
