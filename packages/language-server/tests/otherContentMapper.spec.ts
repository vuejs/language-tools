import type { DocumentSymbol, TextDocument } from '@volar/language-server';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { beforeAll, expect, test } from 'vitest';
import { URI } from 'vscode-uri';
import { getLanguageServer, testWorkspacePath } from './server';

// The `contentMappers` entry of this project names a Vue Content Mapper other than @vue/content-mapper.
const projectPath = path.join(testWorkspacePath, 'otherContentMapper');

beforeAll(() => {
	// TS 7.1 resolves the `package` of an entry from `node_modules`, which the repository does not track.
	const link = path.join(projectPath, 'node_modules', 'stub-vue-mapper');
	if (!fs.existsSync(link)) {
		fs.mkdirSync(path.dirname(link), { recursive: true });
		fs.symlinkSync(path.join(projectPath, 'stub-vue-mapper'), link, 'junction');
	}
});

test('completes the blocks of a .vue file that another content mapper maps', async () => {
	const labels = await withDocument('<', async (server, document) => {
		const completion = await server.vueserver.sendCompletionRequest(document.uri, document.positionAt(1));
		return completion?.items.map(item => item.label);
	});
	expect(labels).toContain('template');
	expect(labels).toContain('script setup');
});

test('completes the directives of a template element', async () => {
	const content = '<template>\n\t<div v-></div>\n</template>\n';
	const labels = await withDocument(content, async (server, document) => {
		const completion = await server.vueserver.sendCompletionRequest(
			document.uri,
			document.positionAt(content.indexOf('v-') + 'v-'.length),
		);
		return completion?.items.map(item => item.label);
	});
	expect(labels).toContain('v-if');
	expect(labels).toContain('v-for');
});

test('lists the blocks in the outline', async () => {
	const content = fs.readFileSync(path.join(projectPath, 'App.vue'), 'utf8');
	const symbols = await withDocument(
		content,
		async (server, document) => await server.vueserver.sendDocumentSymbolRequest(document.uri),
	);
	expect((symbols as DocumentSymbol[] | null)?.map(symbol => [symbol.name, symbol.children?.map(child => child.name)]))
		.toContainEqual(['template', ['div']]);
});

/** Opens the project's `App.vue`, whose project TS 7.1 decides by the file on disk, with `content`. */
async function withDocument<T>(
	content: string,
	fn: (server: Awaited<ReturnType<typeof getLanguageServer>>, document: TextDocument) => Promise<T>,
) {
	const server = await getLanguageServer();
	const uri = URI.file(path.join(projectPath, 'App.vue')).toString();
	const document = await server.open(uri, 'vue', content);
	try {
		return await fn(server, document);
	}
	finally {
		await server.close(uri);
	}
}
