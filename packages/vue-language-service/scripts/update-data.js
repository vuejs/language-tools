const https = require('https');
const fs = require('fs');
const path = require('path');
const langs = [
	{
		name: 'en',
		url: 'https://vuejs.org/',
		languageBlocksMdUrl: 'https://raw.githubusercontent.com/vuejs/docs/main/src/api/sfc-spec.md',
		builtInDirectivesMdUrl: 'https://raw.githubusercontent.com/vuejs/docs/main/src/api/built-in-directives.md',
	},
	{
		name: 'zh-cn',
		url: 'https://cn.vuejs.org/',
		languageBlocksMdUrl: 'https://raw.githubusercontent.com/vuejs-translations/docs-zh-cn/main/src/api/sfc-spec.md',
		builtInDirectivesMdUrl: 'https://raw.githubusercontent.com/vuejs-translations/docs-zh-cn/main/src/api/built-in-directives.md',
	},
	{
		name: 'ja',
		url: 'https://ja.vuejs.org/',
		languageBlocksMdUrl: 'https://raw.githubusercontent.com/vuejs-translations/docs-ja/main/src/api/sfc-spec.md',
		builtInDirectivesMdUrl: 'https://raw.githubusercontent.com/vuejs-translations/docs-ja/main/src/api/built-in-directives.md',
	},
];

for (const lang of langs) {
	builtInDirectivesWorker(lang);
	languageBlocksWorker(lang);
}

async function languageBlocksWorker(lang) {

	let text = (await require('axios').get(lang.languageBlocksMdUrl)).data;
	text = resolveMarkdownLinks(text, lang.url);
	const json = text
		.replace(/```vue-html/g, '```html')
		.split('\n## ')[2]
		.split('\n### ')
		.slice(1)
		.map((section) => {
			const lines = section.split('\n');
			let name = lines[0].trim().split(' ').slice(0, -1).join(' ');
			if (name.startsWith('`<')) {
				name = name.slice(2, -2);
			}
			lines[0] = '## ' + lines[0].trim().split(' ').slice(0, -1).join(' ');
			return {
				name,
				description: {
					kind: 'markdown',
					value: lines.join('\n'),
				},
				references: langs.map(lang => ({
					name: lang.name,
					url: `${lang.url}api/sfc-spec.html#${name.replace(/ /g, '-').toLowerCase()}`,
				})),
			};
		});

	// write json to file
	const writePath = path.resolve(__dirname, '../data/language-blocks/' + lang.name + '.json');
	fs.writeFileSync(writePath, JSON.stringify(json, null, 2));

	console.log('Built-in directives updated successfully!');
	console.log('Path: ' + writePath);
}

async function builtInDirectivesWorker(lang) {

	let text = (await require('axios').get(lang.builtInDirectivesMdUrl)).data;
	text = resolveMarkdownLinks(text, lang.url);
	const json = text
		.replace(/```vue-html/g, '```html')
		.split('\n## ')
		.slice(1)
		.map((section) => {
			const lines = section.split('\n');
			const name = lines[0].trim().split(' ')[0];
			lines[0] = '## ' + lines[0].trim().split(' ').slice(0, -1).join(' ');
			return {
				name,
				valueSet: name === 'v-else' ? 'v' : undefined,
				description: {
					kind: 'markdown',
					value: lines.join('\n'),
				},
				references: langs.map(lang => ({
					name: lang.name,
					url: `${lang.url}api/built-in-directives.html#${name}`,
				})),
			};
		});

	// write json to file
	const writePath = path.resolve(__dirname, '../data/built-in-directives/' + lang.name + '.json');
	fs.writeFileSync(writePath, JSON.stringify(json, null, 2));

	console.log('Built-in directives updated successfully!');
	console.log('Path: ' + writePath);
}

function resolveMarkdownLinks(text, url) {
	return text.replace(/\[(.*?)\]\(\/(.*?)\)/g, (match, p1, p2) => {
		const p2Parts = p2.split('#');
		if (!p2Parts[0].endsWith('.html')) {
			p2Parts[0] += '.html';
		}
		p2 = p2Parts.join('#');
		return `[${p1}](${url}${p2})`;
	});
}