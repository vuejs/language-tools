import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, expect, test } from 'vitest';
import { LspDocument, type LspServer, startLspServer } from './lsp';
import { repositoryRoot } from './utils';

const servers: LspServer[] = [];

afterAll(() => {
	for (const server of servers) {
		server.close();
	}
});

async function check(server: LspServer, page: LspDocument, plain: LspDocument, errors: string[]) {
	page.open(server, 'markdown');
	plain.open(server, 'markdown');

	const definition: any[] = await server.request('textDocument/definition', {
		textDocument: { uri: page.uri },
		position: page.at('count.nope', 0, 1),
	});
	expect(definition.map(location => page.describe(location.range))).toEqual(['3:6 count']);
	expect(definition.every(location => page.is(location.uri))).toBe(true);

	const pageDiagnostics = await server.request('textDocument/diagnostic', { textDocument: { uri: page.uri } });
	expect(
		pageDiagnostics.items
			.filter((item: any) => item.severity === 1)
			.map((item: any) => `${page.describe(item.range)} TS${item.code}`),
	).toEqual(expect.arrayContaining(errors));

	const plainDiagnostics = await server.request('textDocument/diagnostic', { textDocument: { uri: plain.uri } });
	expect(plainDiagnostics.items).toEqual([]);
	expect(
		await server.request('textDocument/definition', {
			textDocument: { uri: plain.uri },
			position: plain.at('count.nope', 0, 1),
		}),
	).toBeNull();
}

test('a tsconfig entry for .vue.md maps those files as VitePress and leaves plain .md alone', async () => {
	const workspace = path.join(repositoryRoot, 'test-workspace/content-mapper-lsp');
	const server = await startLspServer(workspace);
	servers.push(server);
	await check(
		server,
		new LspDocument(path.join(workspace, 'Page.vue.md')),
		new LspDocument(path.join(workspace, 'Plain.md')),
		['4:6 label TS2322', '7:31 nope TS2339'],
	);
});

test('an inferred project contribution for .vue.md maps those files as VitePress and leaves plain .md alone', async () => {
	const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'vue-md-inferred-')));
	let server: LspServer | undefined;
	try {
		const workspace = path.join(repositoryRoot, 'test-workspace/content-mapper-lsp');
		for (const file of ['Page.vue.md', 'Plain.md']) {
			fs.copyFileSync(path.join(workspace, file), path.join(dir, file));
		}
		server = await startLspServer(dir);
		const mapperDir = path.join(repositoryRoot, 'packages/content-mapper');
		// What the VS Code extension registers for files outside any tsconfig
		await server.request('custom/setContentMapperContributions', {
			contributions: [{
				contributorId: 'Vue.volar',
				extensions: ['.vue.md'],
				inferredProjectContribution: {
					options: { languageFeatures: true, target: 99, format: 'vitepress' },
					manifest: {
						name: '@vue/content-mapper',
						exec: [process.execPath, path.join(mapperDir, 'server.js')],
						cwd: mapperDir,
						dynamicConfig: true,
					},
				},
			}],
			openDocuments: [],
		});
		await check(
			server,
			new LspDocument(path.join(dir, 'Page.vue.md')),
			new LspDocument(path.join(dir, 'Plain.md')),
			// `vue` does not resolve from the temporary directory, so only the script is checked here
			['4:6 label TS2322'],
		);
	}
	finally {
		server?.close();
		fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
	}
});
