import { stringToSnapshot } from '@volar/language-service/lib/utils/common';
import { getDefaultCompilerOptions, type VirtualCode } from '@vue/language-core';
import { loadTypeScript } from '@vue/language-core/typescript';
import { expect, test } from 'vitest';
import { createVueLanguagePlugin } from '../lib/languagePlugin';

const fileName = '/project/src/Comp.vue';

function getEmbeddedCodes(content: string) {
	const plugin = createVueLanguagePlugin<string>(loadTypeScript(), getDefaultCompilerOptions(), id => id);
	return plugin.createVirtualCode!(fileName, 'vue', stringToSnapshot(content), {} as never)!.embeddedCodes;
}

function findCode(codes: VirtualCode[] | undefined, id: string): VirtualCode | undefined {
	for (const code of codes ?? []) {
		if (code.id === id) {
			return code;
		}
		const found = findCode(code.embeddedCodes, id);
		if (found) {
			return found;
		}
	}
}

function text(code: VirtualCode | undefined) {
	return code?.snapshot.getText(0, code.snapshot.getLength());
}

test('a pug template has a template document without any plugin', () => {
	const template = findCode(getEmbeddedCodes('<template lang="pug">\ndiv\n  span\n</template>\n'), 'template');
	expect(template?.languageId).toBe('jade');
	expect(text(template)).toBe('\ndiv\n  span\n');
});

test('an indented pug template document is the template as written', () => {
	const startTag = '<template lang="pug">';
	const content = '\n  div\n    span\n';
	const template = findCode(getEmbeddedCodes(`${startTag}${content}</template>\n`), 'template');
	expect(template?.languageId).toBe('jade');
	expect(text(template)).toBe(content);
	expect(template?.mappings).toMatchObject([
		{
			virtualStart: 0,
			virtualEnd: content.length,
			originalStart: startTag.length,
			originalEnd: startTag.length + content.length,
		},
	]);
});
