import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, expect, test } from 'vitest';
import { LspDocument, type LspServer, startLspServer } from './lsp';
import { repositoryRoot } from './utils';

const workspace = path.join(repositoryRoot, 'test-workspace/content-mapper-shared');
const projects = ['a', 'b'];
const log = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'vue-shared-transforms-')), 'transforms.log');
let server: LspServer | undefined;

afterAll(() => {
	server?.close();
	for (const project of projects) {
		fs.rmSync(path.join(workspace, project, 'node_modules'), { recursive: true, force: true });
	}
	fs.rmSync(path.dirname(log), { recursive: true, force: true });
});

test('projects with different tsconfig files but the same effective options share a transform', async () => {
	// Like a pnpm workspace, each project reaches the same Vue package through its own `node_modules`.
	for (const project of projects) {
		const link = path.join(workspace, project, 'node_modules/vue');
		fs.rmSync(link, { recursive: true, force: true });
		fs.mkdirSync(path.dirname(link), { recursive: true });
		fs.symlinkSync(path.join(repositoryRoot, 'test-workspace/node_modules/vue'), link, 'junction');
	}
	fs.writeFileSync(log, '');

	server = await startLspServer(workspace, {
		NODE_OPTIONS: `--require ${JSON.stringify(path.join(__dirname, 'fixtures/countTransforms.cjs'))}`,
		VUE_CONTENT_MAPPER_TRANSFORM_LOG: log,
	});
	for (const project of projects) {
		const main = new LspDocument(path.join(workspace, project, 'main.ts'));
		main.open(server, 'typescript');
		const report = await server.request('textDocument/diagnostic', { textDocument: { uri: main.uri } });
		expect(report.items).toEqual([]);
	}

	const transformed = fs.readFileSync(log, 'utf8').split('\n').filter(Boolean);
	expect(transformed.map(fileName => path.relative(workspace, fileName))).toEqual(['Shared.vue']);
});
