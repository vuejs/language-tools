import type { TextDocument, TextEdit } from '@volar/language-server';
import { DocumentDropRequest } from '@volar/language-server/protocol';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { expect, test } from 'vitest';
import { URI } from 'vscode-uri';
import { getLanguageServer, testWorkspacePath } from './server';

const workspace = path.join(testWorkspacePath, 'documentDrop', 'src');

test('imports a dropped component with the TypeScript language server path alias and name', async () => {
	const { document, edit } = await drop('pages/deep/SetupTarget.vue', 'components/deep/DropComponent.vue');
	expect(edit?.insertText).toBe('<DropComponent$0 />');
	expect(applyEdits(document, edit?.additionalEdit?.changes?.[document.uri])).toBe(
		`<script setup lang="ts">
import DropComponent from '@/components/deep/DropComponent.vue';

const count = 1;
</script>

<template>
	<div>{{ count }}</div>
</template>
`,
	);
});

test('registers a dropped component in the Options API with the name the TypeScript language server binds', async () => {
	const { document, edit } = await drop('pages/deep/OptionsTarget.vue', 'components/deep/drop-item.vue');
	expect(edit?.insertText).toBe('<drop-item$0 />');
	expect(applyEdits(document, edit?.additionalEdit?.changes?.[document.uri])).toContain(
		`import dropItem from '@/components/deep/drop-item.vue';`,
	);
	expect(applyEdits(document, edit?.additionalEdit?.changes?.[document.uri])).toContain(
		'components: { dropItem }',
	);
});

test('adds a dropped component to the Options API components without reprinting them', async () => {
	const { document, edit } = await drop('pages/deep/OptionsComponentsTarget.vue', 'components/deep/drop-item.vue');
	expect(applyEdits(document, edit?.additionalEdit?.changes?.[document.uri])).toContain(
		`	components: {
		// shown on every page
		DropComponent,
		dropItem,
	},`,
	);
});

test('imports a dropped component into an empty script setup', async () => {
	const { document, edit } = await drop('pages/deep/EmptySetupTarget.vue', 'components/deep/DropComponent.vue');
	expect(applyEdits(document, edit?.additionalEdit?.changes?.[document.uri])).toBe(
		`<script setup lang="ts">
import DropComponent from '@/components/deep/DropComponent.vue';
</script>

<template>
	<div></div>
</template>
`,
	);
});

test('does not import a dropped component into an SFC without script', async () => {
	const { edit } = await drop('pages/deep/NoScriptTarget.vue', 'components/deep/DropComponent.vue');
	expect(edit).toBeNull();
});

async function drop(target: string, dropped: string) {
	const server = await getLanguageServer();
	const fileName = path.join(workspace, target);
	// The TypeScript language server reads the target from disk, so the document must match it.
	const content = fs.readFileSync(fileName, 'utf8');
	const document = await server.open(URI.file(fileName).toString(), 'vue', content);
	try {
		const edit = await server.vueserver.connection.sendRequest(DocumentDropRequest.type, {
			textDocument: { uri: document.uri },
			position: document.positionAt(content.indexOf('<template>') + '<template>\n\t'.length),
			dataTransfer: [{ mimeType: 'text/uri-list', value: URI.file(path.join(workspace, dropped)).toString() }],
		});
		return { document, edit };
	}
	finally {
		await server.close(document.uri);
	}
}

function applyEdits(document: TextDocument, edits: TextEdit[] | undefined) {
	let text = document.getText();
	for (
		const edit of [...edits ?? []].sort((a, b) => document.offsetAt(b.range.start) - document.offsetAt(a.range.start))
	) {
		text = text.slice(0, document.offsetAt(edit.range.start)) + edit.newText
			+ text.slice(document.offsetAt(edit.range.end));
	}
	// A Windows checkout may have CRLF fixtures
	return text.replace(/\r\n/g, '\n');
}
