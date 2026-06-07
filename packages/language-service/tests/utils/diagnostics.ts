import { createServiceEnvironment } from '@volar/kit/lib/createServiceEnvironment';
import {
	createLanguage,
	createLanguageService,
	createUriMap,
} from '@volar/language-service';
import { createVueLanguagePlugin, getDefaultCompilerOptions } from '@vue/language-core';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { URI } from 'vscode-uri';
import { createVueLanguageServicePlugins } from '../..';

const fakeUri = URI.file('/fixture.vue');
const vueLanguagePlugin = createVueLanguagePlugin<URI>(
	ts,
	{},
	getDefaultCompilerOptions(),
	() => '',
);
const vueServicePlugins = createVueLanguageServicePlugins(ts);
const language = createLanguage([vueLanguagePlugin], createUriMap(false), () => {});
const languageService = createLanguageService(language, vueServicePlugins, createServiceEnvironment(() => ({})), {});

export function defineDiagnosticsTest(options: {
	title: string;
	content: string;
	expectCodes: (string | number)[];
	expectCount: number;
}) {
	describe(`diagnostics: ${options.title}`, () => {
		it('diagnostics', async () => {
			language.scripts.set(fakeUri, ts.ScriptSnapshot.fromString(options.content), 'vue');
			const diagnostics = await languageService.getDiagnostics(fakeUri);
			const matched = diagnostics.filter(d => options.expectCodes.includes(d.code as string | number));
			expect(matched).toHaveLength(options.expectCount);
		});
	});
}
