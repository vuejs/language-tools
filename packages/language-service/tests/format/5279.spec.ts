import { defineFormatTest } from '../utils/format';

const title = '#' + __filename.split('.')[0];

defineFormatTest({
	title: title + ' (with component)',
	languageId: 'vue',
	input: `
<script setup lang="ts">
const Link = () => { }
</script>

<template>
\t<Link>
\t1
\t</Link>
\t<img>
\t2
\t</img>
\t<foo>
\t1
\t</foo>
</template>
  `.trim(),
	output: `
<script setup lang="ts">
const Link = () => { }
</script>

<template>
\t<Link>
\t\t1
\t</Link>
\t<img>
\t2
\t</img>
\t<foo>
\t\t1
\t</foo>
</template>
  `.trim(),
});

defineFormatTest({
	title: title + ' (without component)',
	languageId: 'vue',
	input: `
<template>
\t<Link>
\t1
\t</Link>
\t<img>
\t2
\t</img>
\t<foo>
\t1
\t</foo>
</template>
  `.trim(),
	output: `
<template>
\t<Link>
\t1
\t</Link>
\t<img>
\t2
\t</img>
\t<foo>
\t\t1
\t</foo>
</template>
  `.trim(),
});
