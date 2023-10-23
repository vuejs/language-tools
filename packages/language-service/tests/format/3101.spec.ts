import { defineFormatTest } from '../utils/format';

defineFormatTest({
	title: '#' + __filename.split('.')[0],
	languageId: 'vue',
	input: `<script lang="ts" setup generic="T extends Record<string, string>"></script>`,
});
