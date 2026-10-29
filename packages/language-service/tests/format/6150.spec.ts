import { defineFormatTest } from '../utils/format';

// https://github.com/vuejs/language-tools/issues/6150
// Unified `js/ts.format.*` settings should be honored in Vue script blocks.
defineFormatTest({
	title: '#' + __filename.split('.')[0],
	languageId: 'vue',
	input: `
<script setup lang="ts">
const a = 1
const b = 2
</script>
	`.trim(),
	output: `
<script setup lang="ts">
const a = 1;
const b = 2;
</script>
	`.trim(),
	settings: {
		'js/ts.format.semicolons': 'insert',
	},
});
