import { defineFormatTest } from '../utils/format';

defineFormatTest({
	title: '#' + __filename.split('.')[0],
	languageId: 'typescript',
	input: `	export { };`,
	output: `export { };`,
});
