import { createServiceEnvironment } from '@volar/kit/lib/createServiceEnvironment';
import {
	type CompletionList,
	createLanguage,
	createLanguageService,
	createUriMap,
	type LanguageServicePlugin,
	type LanguageServicePluginInstance,
	type Position,
} from '@volar/language-service';
import { createVueLanguagePlugin, getDefaultCompilerOptions } from '@vue/language-core';
import * as ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { URI } from 'vscode-uri';

type CompletionProvider = NonNullable<LanguageServicePluginInstance['provideCompletionItems']>;

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>(resolvePromise => {
		resolve = resolvePromise;
	});
	return { promise, resolve };
}

function completionGate() {
	const entered = deferred<Parameters<CompletionProvider>>();
	const result = deferred<CompletionList>();
	const provide: CompletionProvider = (...args) => {
		entered.resolve(args);
		return result.promise; // Deliberately ignore cancellation while awaiting the result.
	};
	return { entered: entered.promise, resolve: result.resolve, provide };
}

function queuedProvider(...providers: CompletionProvider[]) {
	const provide = vi.fn<CompletionProvider>(() => {
		throw new Error('Unexpected completion provider call');
	});
	for (const provider of providers) {
		provide.mockImplementationOnce(provider);
	}
	return provide;
}

function completionPlugin(provide: CompletionProvider, isAdditionalCompletion = false): LanguageServicePlugin {
	return {
		capabilities: { completionProvider: {} },
		create: () => ({
			isAdditionalCompletion,
			provideCompletionItems: (...args) => {
				if (args[0].languageId === 'typescript') {
					return provide(...args);
				}
			},
		}),
	};
}

function createTestService(plugins: LanguageServicePlugin[], vue = false) {
	const language = createLanguage<URI>(
		vue ? [createVueLanguagePlugin<URI>(ts, {}, getDefaultCompilerOptions(), uri => uri.path)] : [],
		createUriMap(false),
		() => {},
	);
	const service = createLanguageService(language, plugins, createServiceEnvironment(() => ({})), {});
	return {
		service,
		setDocument(uri: URI, text: string) {
			language.scripts.set(uri, ts.ScriptSnapshot.fromString(text), vue ? 'vue' : 'typescript');
		},
	};
}

function completionList(label: string, isIncomplete = false, position?: Position): CompletionList {
	return {
		isIncomplete,
		// Same-label alternatives must both survive; deduplication must not hide lost entries.
		items: ['one', 'two'].map(suffix => ({
			label,
			insertText: `${label}:${suffix}`,
			...(position && {
				textEdit: { range: { start: position, end: position }, newText: `${label}:${suffix}` },
			}),
		})),
	};
}

function expectItems(result: CompletionList, ...labels: string[]) {
	const expected = labels.flatMap(label => completionList(label).items);
	const identity = (item: CompletionList['items'][number]) => JSON.stringify([item.label, item.insertText]);
	expect(result.items).toHaveLength(expected.length);
	expect(result.items.map(identity).sort()).toEqual(expected.map(identity).sort());
}

function cancellationToken() {
	return {
		isCancellationRequested: false,
		onCancellationRequested: () => ({ dispose() {} }),
	};
}

const position = { line: 0, character: 1 };
const incomplete = { triggerKind: 3 } as const;

describe('completion request isolation (#6225)', () => {
	describe.each(['same document', 'different documents'])('%s', documents => {
		it.each(['in order', 'in reverse'])('isolates overlapping fresh requests completing %s', async order => {
			const older = completionGate();
			const newer = completionGate();
			const main = queuedProvider(older.provide, newer.provide);
			const additional = vi.fn<CompletionProvider>(document => completionList(`${document.getText()}:additional`));
			const { service, setDocument } = createTestService([
				completionPlugin(main),
				completionPlugin(additional, true),
			]);
			const olderUri = URI.parse('file:///older.ts');
			const newerUri = documents === 'same document' ? olderUri : URI.parse('file:///newer.ts');
			setDocument(olderUri, 'older');
			const olderRequest = service.getCompletionItems(olderUri, position);
			expect((await older.entered)[0].getText()).toBe('older');
			setDocument(newerUri, 'newer');
			const newerRequest = service.getCompletionItems(newerUri, position);
			expect((await newer.entered)[0].getText()).toBe('newer');

			if (order === 'in order') {
				older.resolve(completionList('older:main'));
				await olderRequest;
				newer.resolve(completionList('newer:main'));
			}
			else {
				newer.resolve(completionList('newer:main'));
				await newerRequest;
				older.resolve(completionList('older:main'));
			}
			const [olderResult, newerResult] = await Promise.all([olderRequest, newerRequest]);
			expectItems(olderResult, 'older:main', 'older:additional');
			expectItems(newerResult, 'newer:main', 'newer:additional');
			// Complete entries let a triggerKind 3 request observe the cache without another provider call.
			expectItems(await service.getCompletionItems(newerUri, position, incomplete), 'newer:main', 'newer:additional');
			expect(main).toHaveBeenCalledTimes(2);
			expect(additional).toHaveBeenCalledTimes(2);
		});
	});

	it.each(['before', 'after'])('ignores cancelled work resolving %s the live request', async order => {
		const cancelled = completionGate();
		const live = completionGate();
		const main = queuedProvider(cancelled.provide, live.provide);
		const { service, setDocument } = createTestService([completionPlugin(main)]);
		const uri = URI.parse('file:///cancelled.ts');
		const token = cancellationToken();
		setDocument(uri, 'cancelled');
		// Cancellation may produce an empty result, a partial result, or a rejection.
		const cancelledRequest = service.getCompletionItems(uri, position, undefined, token).then(() => {}, () => {});
		await cancelled.entered;
		setDocument(uri, 'live');
		const liveRequest = service.getCompletionItems(uri, position);
		await live.entered;
		token.isCancellationRequested = true;

		if (order === 'before') {
			cancelled.resolve(completionList('cancelled'));
			await cancelledRequest;
			live.resolve(completionList('live'));
		}
		else {
			live.resolve(completionList('live'));
			await liveRequest;
			cancelled.resolve(completionList('cancelled'));
		}
		await cancelledRequest;
		expectItems(await liveRequest, 'live');
		expectItems(await service.getCompletionItems(uri, position, incomplete), 'live');
		expect(main).toHaveBeenCalledTimes(2);
	});

	it.each([1, 3] as const)(
		'preserves valid cache when a newer triggerKind %i request is cancelled',
		async triggerKind => {
			const cancelled = completionGate();
			const main = queuedProvider(
				() => completionList('seed:main', triggerKind === 3),
				cancelled.provide,
				() => completionList('live:main'),
			);
			const additional = queuedProvider(() => completionList('seed:additional'));
			const { service, setDocument } = createTestService([
				completionPlugin(main),
				completionPlugin(additional, true),
			]);
			const uri = URI.parse('file:///cached.ts');
			setDocument(uri, 'cached');
			expectItems(await service.getCompletionItems(uri, position), 'seed:main', 'seed:additional');
			const token = cancellationToken();
			const cancelledRequest = service.getCompletionItems(uri, position, { triggerKind }, token).then(
				() => {},
				() => {},
			);
			await cancelled.entered;
			token.isCancellationRequested = true;
			cancelled.resolve(completionList('cancelled:main'));
			await cancelledRequest;

			expectItems(
				await service.getCompletionItems(uri, position, incomplete),
				triggerKind === 3 ? 'live:main' : 'seed:main',
				'seed:additional',
			);
			expect(main).toHaveBeenCalledTimes(triggerKind === 3 ? 3 : 2);
			expect(additional).toHaveBeenCalledTimes(1);
		},
	);

	describe.each(['TypeScript', 'embedded Vue'])('%s incomplete completions', language => {
		it.each(['in order', 'in reverse'])('isolates concurrent refreshes completing %s', async order => {
			const olderMain = completionGate();
			const newerMain = completionGate();
			const olderExtra = completionGate();
			const newerExtra = completionGate();
			const main = queuedProvider(
				() => completionList('seed:main', true),
				olderMain.provide,
				newerMain.provide,
			);
			const extra = queuedProvider(
				() => completionList('seed:extra', true),
				olderExtra.provide,
				newerExtra.provide,
			);
			const stable = queuedProvider(() => completionList('seed:stable'));
			const vue = language === 'embedded Vue';
			const { service, setDocument } = createTestService([
				completionPlugin(main),
				completionPlugin(extra, true),
				completionPlugin(stable, true),
			], vue);
			const uri = URI.parse(vue ? 'file:///refresh.vue' : 'file:///refresh.ts');
			const text = 'const value = 1;\nvalue';
			setDocument(uri, vue ? `<script setup lang="ts">\n${text}\n</script>` : text);
			const olderPosition = { line: vue ? 2 : 1, character: 3 };
			const newerPosition = { ...olderPosition, character: 4 };
			const seed = await service.getCompletionItems(uri, olderPosition);
			expectItems(seed, 'seed:main', 'seed:extra', 'seed:stable');
			expect(seed.isIncomplete).toBe(true);

			const olderRequest = service.getCompletionItems(uri, olderPosition, incomplete);
			const [olderDocument, olderMappedPosition] = await olderMain.entered;
			const newerRequest = service.getCompletionItems(uri, newerPosition, incomplete);
			const [newerDocument, newerMappedPosition] = await newerMain.entered;
			if (vue) {
				expect(URI.parse(olderDocument.uri).scheme).toBe('volar-embedded-content');
				expect(newerDocument.uri).toBe(olderDocument.uri);
			}

			// Both refreshes read the incomplete cache before either replaces its entries.
			// Pause again at another incomplete provider to expose shared entry/list writes.
			olderMain.resolve(completionList('older:main', false, olderMappedPosition));
			await olderExtra.entered;
			newerMain.resolve(completionList('newer:main', false, newerMappedPosition));
			await newerExtra.entered;
			if (order === 'in order') {
				olderExtra.resolve(completionList('older:extra'));
				await olderRequest;
				newerExtra.resolve(completionList('newer:extra'));
			}
			else {
				newerExtra.resolve(completionList('newer:extra'));
				await newerRequest;
				olderExtra.resolve(completionList('older:extra'));
			}
			const [olderResult, newerResult] = await Promise.all([olderRequest, newerRequest]);
			expectItems(olderResult, 'older:main', 'older:extra', 'seed:stable');
			expectItems(newerResult, 'newer:main', 'newer:extra', 'seed:stable');
			expect(olderResult.isIncomplete).toBe(false);
			expect(newerResult.isIncomplete).toBe(false);
			for (
				const [result, sourcePosition] of [
					[olderResult, olderPosition],
					[newerResult, newerPosition],
				] as const
			) {
				for (const item of result.items.filter(item => item.label.endsWith(':main'))) {
					expect(item.textEdit).toEqual({
						range: { start: sourcePosition, end: sourcePosition },
						newText: item.insertText,
					});
				}
			}
			expectItems(seed, 'seed:main', 'seed:extra', 'seed:stable');
			expectItems(
				await service.getCompletionItems(uri, newerPosition, incomplete),
				'newer:main',
				'newer:extra',
				'seed:stable',
			);
			expect(main).toHaveBeenCalledTimes(3);
			expect(extra).toHaveBeenCalledTimes(3);
			expect(stable).toHaveBeenCalledTimes(1);
		});
	});
});
