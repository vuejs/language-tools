import type { TextDocument } from '@volar/language-server';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, expect, test } from 'vitest';
import { URI } from 'vscode-uri';
import { getLanguageServer, testWorkspacePath } from './server';

test('#5818 clears missing module error after renaming to an existing filename', async () => {
	const server = await getLanguageServer();
	const workspaceDir = path.join(testWorkspacePath, 'tsconfigProject');
	const mainPath = path.join(workspaceDir, 'module-rename-main.vue');
	const oldComponentPath = path.join(workspaceDir, 'module-rename-comp.vue');
	const newComponentPath = path.join(workspaceDir, 'module-rename-comp-renamed.vue');

	createFile(oldComponentPath, '<template>Comp</template>');
	const mainContent = `
<script setup lang="ts">
import Comp from './module-rename-comp-renamed.vue'
</script>
        `;
	const document = await openDocument(server, mainPath, mainContent);

	const diagnosticsBefore = await getSemanticDiagnostics(server, document.uri);
	expect(diagnosticsBefore.some(diagnostic => diagnostic.code === 2307)).toBe(true);

	fs.renameSync(oldComponentPath, newComponentPath);
	createdFiles.push(newComponentPath);

	await expect.poll(
		async () => {
			const diagnosticsAfter = await getSemanticDiagnostics(server, document.uri);
			return diagnosticsAfter.some(diagnostic => diagnostic.code === 2307);
		},
		{
			interval: 100,
			timeout: 5000,
		},
	).toBe(false);
});

test('resolves module names with the owning project in a multi-project session', async () => {
	const server = await getLanguageServer();
	const firstProjectFile = path.join(testWorkspacePath, 'tsconfigProject', 'fixture.vue');
	const secondProjectFile = path.join(testWorkspacePath, 'tsconfigProject2', 'fixture.vue');

	// Open a file of the first project before any file of the second project,
	// so the session-level `_vue:` handlers are registered by the first project.
	for (const fileName of [firstProjectFile, secondProjectFile]) {
		const document = await server.open(URI.file(fileName).toString(), 'vue', fs.readFileSync(fileName, 'utf8'));
		if (openedDocuments.every(doc => doc.uri !== document.uri)) {
			openedDocuments.push(document);
		}
	}

	// The `@2/*` path alias only exists in tsconfigProject2, so the module can
	// only be resolved with the second project's compilerOptions.
	const res = await server.tsserver.message({
		seq: server.nextSeq(),
		command: '_vue:resolveModuleName',
		arguments: [secondProjectFile, '@2/fixture'],
	});
	expect(res.success).toBe(true);
	expect(res.body?.replace(/\\/g, '/')).toBe(
		path.join(testWorkspacePath, 'tsconfigProject2', 'fixture.ts').replace(/\\/g, '/'),
	);
});

const openedDocuments: TextDocument[] = [];
const createdFiles: string[] = [];

afterEach(async () => {
	const server = await getLanguageServer();
	for (const document of openedDocuments) {
		await server.close(document.uri);
	}
	openedDocuments.length = 0;
	for (const file of createdFiles) {
		if (fs.existsSync(file)) {
			fs.rmSync(file);
		}
	}
	createdFiles.length = 0;
});

function createFile(fileName: string, content: string) {
	fs.writeFileSync(fileName, content);
	createdFiles.push(fileName);
}

async function openDocument(server: Awaited<ReturnType<typeof getLanguageServer>>, fileName: string, content: string) {
	createFile(fileName, content);
	const uri = URI.file(fileName);
	const document = await server.open(uri.toString(), 'vue', content);
	if (openedDocuments.every(doc => doc.uri !== document.uri)) {
		openedDocuments.push(document);
	}
	return document;
}

async function getSemanticDiagnostics(server: Awaited<ReturnType<typeof getLanguageServer>>, uri: string) {
	const res = await server.tsserver.message({
		seq: server.nextSeq(),
		command: 'semanticDiagnosticsSync',
		arguments: {
			file: URI.parse(uri).fsPath,
		},
	});
	expect(res.success).toBe(true);
	return res.body as any[];
}
