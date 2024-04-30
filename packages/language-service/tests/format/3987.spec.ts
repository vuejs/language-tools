import { defineFormatTest } from '../utils/format';

defineFormatTest({
	title: '#' + __filename.split('.')[0],
	languageId: 'vue',
	input: `
<style lang="scss"
			 scoped>
			.wrapper {
				display: block;
			}
		</style>
	`.trim(),
	output: `
<style lang="scss" scoped>
.wrapper {
	display: block;
}
</style>
	`.trim(),
	settings: {
		'html.format.wrapAttributes': 'force-aligned',
	},
});
