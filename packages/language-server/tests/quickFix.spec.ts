import type { TextDocument } from '@volar/language-server';
import { afterEach, expect, test } from 'vitest';
import { URI } from 'vscode-uri';
import { getLanguageServer, testWorkspacePath } from './server.js';

const openedDocuments: TextDocument[] = [];

afterEach(async () => {
	const server = await getLanguageServer();
	for (const document of openedDocuments) {
		await server.close(document.uri);
	}
	openedDocuments.length = 0;
});

test('"Add import" quick fix for undefined variable in template', async () => {
	await prepareDocument('tsconfigProject/fixture.ts', 'typescript', `export function foo() {}`);

	const codeFixes = await requestCodeFixes(
		'tsconfigProject/fixture.vue',
		'vue',
		`
    <template>
            <button @click="|foo"></button>
    </template>

    <script setup lang="ts">
    </script>
    `,
		'foo',
	);

	expect(
		codeFixes.some(
			codeFix =>
				codeFix.fixName === 'import'
				&& codeFix.description.includes('./fixture'),
		),
	).toBe(true);
});

async function requestCodeFixes(
	fileName: string,
	languageId: string,
	content: string,
	identifier: string,
) {
	const offset = content.indexOf('|');
	expect(offset).toBeGreaterThanOrEqual(0);

	content = content.slice(0, offset) + content.slice(offset + 1);

	const server = await getLanguageServer();
	const document = await prepareDocument(fileName, languageId, content);
	const start = document.positionAt(offset);
	const end = document.positionAt(offset + identifier.length);

	const diagnostics = await server.tsserver.message({
		seq: server.nextSeq(),
		command: 'semanticDiagnosticsSync',
		arguments: {
			file: URI.parse(document.uri).fsPath,
			startLine: start.line + 1,
			startOffset: start.character + 1,
			endLine: end.line + 1,
			endOffset: end.character + 1,
		},
	});
	expect(diagnostics.success).toBe(true);

	const errorCodes = (diagnostics.body as any[])
		.map((diagnostic: any) => diagnostic.code)
		.filter((code): code is number => typeof code === 'number');

	expect(errorCodes.length).toBeGreaterThan(0);

	const res = await server.tsserver.message({
		seq: server.nextSeq(),
		command: 'getCodeFixes',
		arguments: {
			file: URI.parse(document.uri).fsPath,
			startLine: start.line + 1,
			startOffset: start.character + 1,
			endLine: end.line + 1,
			endOffset: end.character + 1,
			errorCodes,
		},
	});

	expect(res.success).toBe(true);
	return res.body as any[];
}

async function prepareDocument(fileName: string, languageId: string, content: string) {
	const server = await getLanguageServer();
	const uri = URI.file(`${testWorkspacePath}/${fileName}`);
	const document = await server.open(uri.toString(), languageId, content);
	if (openedDocuments.every(d => d.uri !== document.uri)) {
		openedDocuments.push(document);
	}
	return document;
}
