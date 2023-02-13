const https = require('https');
const fs = require('fs');
const path = require('path');
const langs = [
	{
		name: 'en',
		url: 'https://vuejs.org/',
		builtInDirectivesMdUrl: 'https://raw.githubusercontent.com/vuejs/docs/main/src/api/built-in-directives.md',
	},
	{
		name: 'zh-cn',
		url: 'https://cn.vuejs.org/',
		builtInDirectivesMdUrl: 'https://raw.githubusercontent.com/vuejs-translations/docs-zh-cn/main/src/api/built-in-directives.md',
	},
	{
		name: 'ja',
		url: 'https://ja.vuejs.org/',
		builtInDirectivesMdUrl: 'https://raw.githubusercontent.com/vuejs-translations/docs-ja/main/src/api/built-in-directives.md',
	},
];

for (const lang of langs) {
	builtInDirectivesWorker(lang);
}

async function builtInDirectivesWorker(lang) {

	const builtInDirectives = await fetchText(lang.builtInDirectivesMdUrl);
	const builtInDirectivesJson = builtInDirectives
		.replace(/```vue-html/g, '```html')
		.replace(/\]\(\//g, `](${lang.url}`)
		.split('\n##')
		.slice(1)
		.map((section) => {
			const lines = section.split('\n');
			const name = lines[0].trim().split(' ')[0];
			const firstLine = lines[0].trim().split(' ').slice(0, -1);
			firstLine[0] = `[${firstLine[0]}](${lang.url}api/built-in-directives.html#${name})`;
			lines[0] = '## ' + firstLine.join(' ');
			return {
				name,
				valueSet: name === 'v-else' ? 'v' : undefined,
				description: {
					kind: 'markdown',
					value: lines.join('\n'),
				},
			};
		});

	// write json to file
	const writePath = path.resolve(__dirname, '../data/built-in-directives/' + lang.name + '.json');
	fs.writeFileSync(writePath, JSON.stringify(builtInDirectivesJson, null, 2));

	console.log('Built-in directives updated successfully!');
	console.log('Path: ' + writePath);
}

// fetch markdown content from vuejs.org
function fetchText(url) {
	return new Promise((resolve, reject) => {
		https.get(
			url,
			(res) => {
				let data = ''
				res.on('data', (chunk) => {
					data += chunk
				})
				res.on('end', () => {
					resolve(data)
				})
			}
		)
	})
}
