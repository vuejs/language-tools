import type * as html from 'vscode-html-languageservice';

let locale: { name: string; url: string }[] | undefined;

export function loadTemplateData(lang: string) {
	lang = lang.toLowerCase();

	let data: html.HTMLDataV1;

	if (lang === 'ja') {
		data = require('../data/template/ja.json');
	}
	else if (lang === 'fr') {
		data = require('../data/template/fr.json');
	}
	else if (lang === 'ko') {
		data = require('../data/template/ko.json');
	}
	else if (lang === 'pt-br') {
		data = require('../data/template/pt.json');
	}
	else if (lang === 'zh-cn') {
		data = require('../data/template/zh-cn.json');
	}
	else if (lang === 'zh-tw') {
		data = require('../data/template/zh-hk.json');
	}
	else if (lang === 'it') {
		data = require('../data/template/it.json');
	}
	else if (lang === 'cs') {
		data = require('../data/template/cs.json');
	}
	else if (lang === 'ru') {
		data = require('../data/template/ru.json');
	}
	else {
		data = require('../data/template/en.json');
	}

	resolveReferences(data);

	return {
		...data,
		globalAttributes: [
			...data.globalAttributes ?? [],
			{
				name: 'v-match',
				description:
					'RFC #823 reference implementation: evaluate one subject and render the first matching v-when arm. Template type checking requires exhaustive coverage.',
				references: [{
					name: 'RFC #823 (Draft reference implementation)',
					url: 'https://github.com/vuejs/rfcs/pull/823',
				}],
			},
			{
				name: 'v-when',
				description:
					'RFC #823 reference implementation: a pattern with optional const/rest/as bindings and an if (guard). Must be a direct v-match child. No arguments, modifiers, or shorthand.',
				references: [{
					name: 'RFC #823 (Draft reference implementation)',
					url: 'https://github.com/vuejs/rfcs/pull/823',
				}],
			},
		],
	};
}

export function loadLanguageBlocks(lang: string): html.HTMLDataV1 {
	lang = lang.toLowerCase();

	let data: html.HTMLDataV1;

	if (lang === 'ja') {
		data = require('../data/language-blocks/ja.json');
	}
	else if (lang === 'fr') {
		data = require('../data/language-blocks/fr.json');
	}
	else if (lang === 'ko') {
		data = require('../data/language-blocks/ko.json');
	}
	else if (lang === 'pt-br') {
		data = require('../data/language-blocks/pt.json');
	}
	else if (lang === 'zh-cn') {
		data = require('../data/language-blocks/zh-cn.json');
	}
	else if (lang === 'zh-tw') {
		data = require('../data/language-blocks/zh-hk.json');
	}
	else if (lang === 'it') {
		data = require('../data/language-blocks/it.json');
	}
	else if (lang === 'cs') {
		data = require('../data/language-blocks/cs.json');
	}
	else if (lang === 'ru') {
		data = require('../data/language-blocks/ru.json');
	}
	else {
		data = require('../data/language-blocks/en.json');
	}

	resolveReferences(data);

	return data;
}

export function loadModelModifiersData(lang: string): html.HTMLDataV1 {
	lang = lang.toLowerCase();

	let data: html.HTMLDataV1;

	if (lang === 'ja') {
		data = require('../data/model-modifiers/ja.json');
	}
	else if (lang === 'fr') {
		data = require('../data/model-modifiers/fr.json');
	}
	else if (lang === 'ko') {
		data = require('../data/model-modifiers/ko.json');
	}
	else if (lang === 'pt-br') {
		data = require('../data/model-modifiers/pt.json');
	}
	else if (lang === 'zh-cn') {
		data = require('../data/model-modifiers/zh-cn.json');
	}
	else if (lang === 'zh-tw') {
		data = require('../data/model-modifiers/zh-hk.json');
	}
	else if (lang === 'it') {
		data = require('../data/model-modifiers/it.json');
	}
	else if (lang === 'cs') {
		data = require('../data/model-modifiers/cs.json');
	}
	else if (lang === 'ru') {
		data = require('../data/model-modifiers/ru.json');
	}
	else {
		data = require('../data/model-modifiers/en.json');
	}

	resolveReferences(data);

	return data;
}

function resolveReferences(data: html.HTMLDataV1) {
	locale ??= require('../data/locale.json');

	for (
		const item of [
			...data.globalAttributes ?? [],
			...data.tags?.flatMap(tag => [tag, ...tag.attributes]) ?? [],
		]
	) {
		if (typeof item.references === 'string') {
			const relativeUrl = item.references as string;
			item.references = locale!.map(({ name, url }) => ({
				name,
				url: url + relativeUrl,
			}));
		}
	}
}
