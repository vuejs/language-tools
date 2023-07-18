import { defineFormatTest } from '../utils/format';

defineFormatTest({
	title: '#' + __filename.split('.')[0],
	languageId: 'vue',
	input: `
<script>
function foo(params) {
console.log('foo');
}
</script>
	`.trim(),
	output: `
<script>
function foo(params) {
	console.log('foo');
}
</script>
	`.trim(),
});
