import { defineFormatTest } from '../utils/format';

defineFormatTest({
	title: '#' + __filename.split('.')[0],
	formatsTypeScript: true,
	languageId: 'vue',
	input: `
<style>
a {
	background: v-bind(' props.background|| "var(--primary-lighter)"');
}
</style>
	`.trim(),
	output: `
<style>
a {
	background: v-bind('props.background || "var(--primary-lighter)"');
}
</style>
	`.trim(),
});
