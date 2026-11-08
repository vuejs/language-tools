import { createServiceEnvironment } from '@volar/kit/lib/createServiceEnvironment';
import { createLanguage, createLanguageService, createUriMap } from '@volar/language-service';
import { createVueLanguagePlugin, getDefaultCompilerOptions } from '@vue/language-core';
import type { VueCompletionData } from '@vue/typescript-plugin/lib/common';
import type { Requests } from '@vue/typescript-plugin/lib/requests';
import * as ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { URI } from 'vscode-uri';
import { create as createVueTemplatePlugin } from '../lib/plugins/vue-template';

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>(resolvePromise => {
		resolve = resolvePromise;
	});
	return { promise, resolve };
}

function fixture(fileName: string, text: string, templateLine: number, scriptLine: number) {
	const position = text.indexOf('<Sha') + '<Sha'.length;
	const data = {
		exportName: 'default',
		moduleSpecifier: './SharedCard.vue',
		fileName: '/SharedCard.vue',
		__vue__autoImport: { fileName },
		__vue__componentAutoImport: { oldName: 'SharedCardVue', newName: 'SharedCard' },
		__vue__autoImportSuggestions: {
			fileName,
			position,
			entryName: 'SharedCardVue',
			source: './SharedCard.vue',
		},
	} satisfies VueCompletionData;
	const completion: ts.CompletionInfo = {
		isGlobalCompletion: false,
		isMemberCompletion: false,
		isNewIdentifierLocation: false,
		entries: [{
			name: 'SharedCard',
			kind: ts.ScriptElementKind.alias,
			kindModifiers: '',
			sortText: '0',
			source: './SharedCard.vue',
			hasAction: true,
			data,
		}],
	};
	return {
		uri: URI.file(fileName),
		text,
		position,
		data,
		completion,
		entered: deferred<Parameters<Requests['getAutoImportSuggestions']>>(),
		result: deferred<ts.CompletionInfo>(),
		textEdit: {
			range: {
				start: { line: templateLine, character: 3 },
				end: { line: templateLine, character: 6 },
			},
			newText: 'SharedCard',
		},
		importEdit: {
			range: {
				start: { line: scriptLine, character: 0 },
				end: { line: scriptLine, character: 0 },
			},
			newText: "import SharedCard from './SharedCard.vue';\n",
		},
	};
}

describe('Vue template auto-import completion resolve (#6225)', () => {
	it.each(['in order', 'in reverse'])('resolves serialized items after overlapping lists finish %s', async order => {
		const older = fixture(
			'/older.vue',
			[
				'<script setup lang="ts">',
				'const oldValue = 1;',
				'</script>',
				'',
				'<template>',
				'  <Sha />',
				'</template>',
			].join('\n'),
			5,
			1,
		);
		const newer = fixture(
			'/newer.vue',
			[
				'<!-- New file has a different layout. -->',
				'',
				'<script setup lang="ts">',
				'',
				'const newValue = 2;',
				'',
				'</script>',
				'',
				'<template>',
				'  <Sha />',
				'</template>',
			].join('\n'),
			9,
			4,
		);
		const fixtures = new Map([older, newer].map(value => [value.uri.path, value]));
		const getAutoImportSuggestions = vi.fn<Requests['getAutoImportSuggestions']>((fileName, position) => {
			const value = fixtures.get(fileName)!;
			value.entered.resolve([fileName, position]);
			return value.result.promise;
		});
		const resolveAutoImportCompletionEntry = vi.fn<Requests['resolveAutoImportCompletionEntry']>(data => {
			const value = fixtures.get(data!.__vue__autoImportSuggestions!.fileName)!;
			expect(data).toMatchObject(value.data);
			return {
				name: 'SharedCard',
				kind: ts.ScriptElementKind.alias,
				kindModifiers: '',
				displayParts: [{ kind: 'text', text: `resolved:${value.uri.path}` }],
				codeActions: [{
					description: 'Import SharedCard',
					changes: [{
						fileName: value.uri.path,
						textChanges: [{
							span: { start: value.text.indexOf('const '), length: 0 },
							newText: value.importEdit.newText,
						}],
					}],
				}],
			};
		});
		const client: Partial<Requests> = {
			getComponentNames: () => [],
			getElementNames: () => [],
			getAutoImportSuggestions,
			resolveAutoImportCompletionEntry,
		};
		const language = createLanguage<URI>(
			[createVueLanguagePlugin<URI>(ts, {}, getDefaultCompilerOptions(), uri => uri.path)],
			createUriMap(false),
			() => {},
		);
		const service = createLanguageService(
			language,
			[createVueTemplatePlugin(ts, 'html', client as Requests)],
			createServiceEnvironment(() => ({})),
			{},
		);
		try {
			for (const value of fixtures.values()) {
				language.scripts.set(value.uri, ts.ScriptSnapshot.fromString(value.text), 'vue');
			}
			const olderRequest = service.getCompletionItems(older.uri, older.textEdit.range.end);
			expect(await Promise.race([older.entered.promise, olderRequest])).toEqual([older.uri.path, older.position]);
			const newerRequest = service.getCompletionItems(newer.uri, newer.textEdit.range.end);
			expect(await Promise.race([newer.entered.promise, newerRequest])).toEqual([newer.uri.path, newer.position]);
			// Both real template providers are waiting for tsserver before either list finishes.
			if (order === 'in order') {
				older.result.resolve(older.completion);
				await olderRequest;
				newer.result.resolve(newer.completion);
			}
			else {
				newer.result.resolve(newer.completion);
				await newerRequest;
				older.result.resolve(older.completion);
			}
			const olderList = await olderRequest;
			const newerList = await newerRequest;
			const newerSnapshot = structuredClone(newerList);
			for (const [list, value] of [[olderList, older], [newerList, newer]] as const) {
				const items = list.items.filter(item => item.label === 'SharedCard');
				expect(items).toHaveLength(1);
				expect(items[0]!.textEdit).toEqual(value.textEdit);
				// Resolve the returned LSP item after a serialization boundary, including the old item
				// after the newer file has completed. Identical labels cannot identify the document.
				const resolved = await service.resolveCompletionItem(structuredClone(items[0]!));
				expect.soft(resolved.textEdit).toEqual(value.textEdit);
				expect.soft(resolved.additionalTextEdits).toEqual([value.importEdit]);
				expect(resolved.detail).toContain(`resolved:${value.uri.path}`);
				expect(resolved.data).toBeUndefined();
			}
			expect(newerList).toEqual(newerSnapshot);
			expect(await service.getCompletionItems(newer.uri, newer.textEdit.range.end, { triggerKind: 3 }))
				.toEqual(newerSnapshot);
			expect(getAutoImportSuggestions).toHaveBeenCalledTimes(2);
			expect(resolveAutoImportCompletionEntry).toHaveBeenCalledTimes(2);
		}
		finally {
			service.dispose();
		}
	});
});
