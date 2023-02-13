/**
 * @type {import('axios').AxiosInstance}
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const langs = [
	{
		name: 'en',
		url: 'https://vuejs.org/',
		repoUrl: 'https://raw.githubusercontent.com/vuejs/docs/',
	},
	{
		name: 'zh-cn',
		url: 'https://cn.vuejs.org/',
		repoUrl: 'https://raw.githubusercontent.com/vuejs-translations/docs-zh-cn/',
	},
	{
		name: 'ja',
		url: 'https://ja.vuejs.org/',
		repoUrl: 'https://raw.githubusercontent.com/vuejs-translations/docs-ja/',
	},
	{
		name: 'ua',
		url: 'https://ua.vuejs.org/',
		repoUrl: 'https://raw.githubusercontent.com/vuejs-translations/docs-ua/',
	},
	{
		name: 'fr',
		url: 'https://fr.vuejs.org/',
		repoUrl: 'https://raw.githubusercontent.com/vuejs-translations/docs-fr/',
	},
];

for (const lang of langs) {
	builtInDirectivesWorker(lang);
	languageBlocksWorker(lang);
}

async function languageBlocksWorker(lang) {

	const sfcDoc = await fetch(lang.repoUrl + 'main/src/api/sfc-spec.md', lang.url);
	const scriptSetupDoc = await fetch(lang.repoUrl + 'main/src/api/sfc-script-setup.md', lang.url);
	const cssFeaturesDoc = await fetch(lang.repoUrl + 'main/src/api/sfc-css-features.md', lang.url);

	/**
	 * @type {import('vscode-html-languageservice').IAttributeData}
	 */
	const langAttr = {
		name: 'lang',
		description: {
			kind: 'markdown',
			value: sfcDoc.split('\n## ')[4].split('\n').slice(1).join('\n'),
		},
		values: [
			// // custom block
			// { name: 'md' },
			// { name: 'json' },
			// { name: 'jsonc' },
			// { name: 'json5' },
			// { name: 'yaml' },
			// { name: 'toml' },
			// { name: 'gql' },
			// { name: 'graphql' },
		],
		references: langs.map(lang => ({
			name: lang.name,
			url: `${lang.url}api/sfc-spec.html#pre-processors`,
		})),
	};
	/**
	 * @type {import('vscode-html-languageservice').IAttributeData}
	 */
	const srcAttr = {
		name: 'src',
		description: {
			kind: 'markdown',
			value: sfcDoc.split('\n## ')[5].split('\n').slice(1).join('\n'),
		},
		references: langs.map(lang => ({
			name: lang.name,
			url: `${lang.url}api/sfc-spec.html#src-imports`,
		})),
	};
	const languageBlocks = sfcDoc
		.split('\n## ')[2]
		.split('\n### ')
		.slice(1)
		.map((section) => {
			const lines = section.split('\n');
			let name = lines[0].trim();
			if (name.startsWith('`<')) {
				name = name.slice(2, -2);
			}
			/**
			 * @type {import('vscode-html-languageservice').ITagData}
			 */
			const data = {
				name,
				attributes: [srcAttr],
				description: {
					kind: 'markdown',
					value: lines.slice(1).join('\n'),
				},
				references: langs.map(lang => ({
					name: lang.name,
					url: `${lang.url}api/sfc-spec.html#${name.replace(/ /g, '-').toLowerCase()}`,
				})),
			};
			if (name === 'template') {
				data.attributes.push({
					...langAttr,
					values: [
						{ name: 'html' },
						{ name: 'pug' },
					],
				});
			}
			if (name === 'script') {
				data.attributes.push({
					...langAttr,
					values: [
						{ name: 'ts' },
						{ name: 'js' },
						{ name: 'tsx' },
						{ name: 'jsx' },
					],
				});
				data.attributes.push({
					name: 'setup',
					valueSet: 'v',
					description: {
						kind: 'markdown',
						value: scriptSetupDoc.split('\n## ')[0].split('\n').slice(1).join('\n'),
					},
					references: langs.map(lang => ({
						name: lang.name,
						url: `${lang.url}api/sfc-script-setup.html`,
					})),
				});
				data.attributes.push({ name: 'generic' });
			}
			if (name === 'style') {
				data.attributes.push({
					...langAttr,
					values: [
						{ name: 'css' },
						{ name: 'scss' },
						{ name: 'less' },
						{ name: 'stylus' },
						{ name: 'postcss' },
						{ name: 'sass' },
					],
				});
				data.attributes.push({
					name: 'scoped',
					valueSet: 'v',
					description: {
						kind: 'markdown',
						value: cssFeaturesDoc.split('\n## ')[1].split('\n').slice(1).join('\n'),
					},
					references: langs.map(lang => ({
						name: lang.name,
						url: `${lang.url}api/sfc-css-features.html#scoped-css`,
					})),
				});
				data.attributes.push({
					name: 'module',
					valueSet: 'v',
					description: {
						kind: 'markdown',
						value: cssFeaturesDoc.split('\n## ')[2].split('\n').slice(1).join('\n'),
					},
					references: langs.map(lang => ({
						name: lang.name,
						url: `${lang.url}api/sfc-css-features.html#css-modules`,
					})),
				});
			}
			return data;
		});

	/**
	 * @type {import('vscode-html-languageservice').HTMLDataV1}
	 */
	const data = {
		version: 1.1,
		tags: languageBlocks,
		globalAttributes: [langAttr, srcAttr],
	};

	const writePath = path.resolve(__dirname, '../data/language-blocks/' + lang.name + '.json');
	fs.writeFileSync(writePath, JSON.stringify(data, null, 2));

	console.log(writePath);
}

async function builtInDirectivesWorker(lang) {

	const text = await fetch(lang.repoUrl + 'main/src/api/built-in-directives.md', lang.url);
	const json = text
		.split('\n## ')
		.slice(1)
		.map((section) => {
			const lines = section.split('\n');
			const name = lines[0].trim().split(' ')[0];
			/**
			 * @type {import('vscode-html-languageservice').IAttributeData}
			 */
			const data = {
				name,
				valueSet: name === 'v-else' ? 'v' : undefined,
				description: {
					kind: 'markdown',
					value: lines.slice(1).join('\n'),
				},
				references: langs.map(lang => ({
					name: lang.name,
					url: `${lang.url}api/built-in-directives.html#${name}`,
				})),
			};
			return data;
		});

	const writePath = path.resolve(__dirname, '../data/built-in-directives/' + lang.name + '.json');
	fs.writeFileSync(writePath, JSON.stringify(json, null, 2));

	console.log(writePath);
}

async function fetch(url, baseUrl) {
	/**
	 * @type {string}
	 */
	let text = (await axios.get(url)).data;
	text = text.replace(/```vue-html/g, '```html');
	text = text.replace(/\{\#.*?\}/g, '')
	text = resolveMarkdownLinks(text, baseUrl);
	return text;
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
