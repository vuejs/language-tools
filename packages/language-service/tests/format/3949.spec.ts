import { defineFormatTest } from '../utils/format';

defineFormatTest({
	title: '#' + __filename.split('.')[0],
	languageId: 'vue',
	input: `
<script lang="tsx">
const a = <div>a</div>
</script>
	`.trim(),
});
