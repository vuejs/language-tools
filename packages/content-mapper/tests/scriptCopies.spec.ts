import { scriptFeatures } from '@vue/language-core';
import { expect, test } from 'vitest';
import { generate } from './utils';

// No native result is known to change with an empty copy here: hover, definition, references, highlights,
// completions and their import edits at the end of the block and at the export, and the diagnostics and code actions
// of the file, stay the same with one.
test('maps no empty copy of the user code at the end of a block that ends with its default export', () => {
	const content = `<script lang="ts">\nexport default {};</script>\n`;
	const blockEnd = content.indexOf('</script>');
	const { mappings } = generate('/Comp.vue', content);
	expect(
		mappings.filter(({ virtualStart, virtualEnd, originalStart, originalEnd, features }) =>
			virtualStart === virtualEnd && originalStart === originalEnd && originalStart === blockEnd
			&& features === scriptFeatures
		),
	).toEqual([]);
});
