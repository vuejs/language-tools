import { defineFormatTest } from '../utils/format';

defineFormatTest({
	title: '#' + __filename.split('.')[0],
	languageId: 'vue',
	input: `
<script>
const str1 = \`
txt
\`;

const str2 = \`
txt	\${ '' +
str1
}
txt
\`;
</script>
	`.trim(),
	output: `
<script>
	const str1 = \`
txt
\`;

	const str2 = \`
txt	\${'' +
		str1
		}
txt
\`;
</script>
	`.trim(),
	settings: {
		'vue.format.script.initialIndent': true,
	},
});
