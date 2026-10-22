import { expect, test } from 'vitest';
import { URI } from 'vscode-uri';
import { getLanguageServer, testWorkspacePath } from './server';

test('.vue.md files are VitePress pages and plain .md files get no Vue language features', async () => {
	expect(await completionLabels('content-mapper-vitepress/main.vue.md')).toContain('div');
	expect(await completionLabels('content-mapper-vitepress/plain.md')).toEqual([]);
});

async function completionLabels(file: string) {
	const server = await getLanguageServer();
	const content = '# Page\n\n<';
	const uri = URI.file(`${testWorkspacePath}/${file}`).toString();
	const document = await server.open(uri, 'markdown', content);
	try {
		const completions = await server.vueserver.sendCompletionRequest(document.uri, document.positionAt(content.length));
		return completions?.items.map(item => item.label) ?? [];
	}
	finally {
		await server.close(document.uri);
	}
}
