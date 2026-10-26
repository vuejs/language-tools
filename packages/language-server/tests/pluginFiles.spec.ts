import { DidChangeWatchedFilesNotification, FileChangeType } from '@volar/language-server';
import * as fs from 'node:fs';
import { afterAll, expect, test } from 'vitest';
import { URI } from 'vscode-uri';
import { getLanguageServer, testWorkspacePath } from './server';

const pluginFile = `${testWorkspacePath}/languageServerPlugin/plugin.cjs`;
const originalPlugin = fs.readFileSync(pluginFile, 'utf8');
const fixtureUri = URI.file(`${testWorkspacePath}/languageServerPlugin/fixture.vue`).toString();

afterAll(async () => {
	fs.writeFileSync(pluginFile, originalPlugin);
	await (await getLanguageServer()).close(fixtureUri);
});

test('a project of the language server uses its plugins again after a plugin file changes', async () => {
	const content = `<template>\n\t<div>{{ foo }} [[ bar ]]</div>\n</template>\n`;
	const server = await getLanguageServer();
	const document = await server.open(fixtureUri, 'vue', content);
	const interpolations = async () => {
		const ranges: [number, number][] = await server.vueserver.connection.sendRequest('vue/interpolationRanges', {
			textDocument: { uri: document.uri },
		});
		return ranges.map(([start, end]) => content.slice(start, end));
	};
	expect(await interpolations()).toEqual([' foo ']);

	fs.writeFileSync(
		pluginFile,
		`exports.ir = { resolveTemplateCompilerOptions: options => ({ ...options, delimiters: ['[[', ']]'] }) };\n`,
	);
	await server.vueserver.connection.sendNotification(DidChangeWatchedFilesNotification.type, {
		changes: [{ uri: URI.file(pluginFile).toString(), type: FileChangeType.Changed }],
	});
	await expect.poll(interpolations).toEqual([' bar ']);
});
