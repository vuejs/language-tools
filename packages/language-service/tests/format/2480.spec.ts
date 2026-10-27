import { defineFormatTest } from '../utils/format';

defineFormatTest({
	title: '#' + __filename.split('.')[0],
	formatsTypeScript: true,
	languageId: 'typescript',
	input: `	export { };`,
	output: `export { };`,
});
