import { defineFormatTest } from '../utils/format';

defineFormatTest({
	title: '#' + __filename.split('.')[0],
	languageId: 'vue',
	input: `
<script>
export { }
</script>
	`.trim().replace('\n', '\r\n'), // CRLF
});
