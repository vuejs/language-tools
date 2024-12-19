import type * as html from 'vscode-html-languageservice';

let locale: { name: string, url: string; }[];

export function loadTemplateData(lang: string) {

	lang = lang.toLowerCase();

	let data: html.HTMLDataV1;

	if (lang === 'ja') {
		data = require('../../data/template/ja.json');
	}
	else if (lang === 'fr') {
		data = require('../../data/template/fr.json');
	}
	else if (lang === 'ko') {
		data = require('../../data/template/ko.json');
	}
	else if (lang === 'pt-br') {
		data = require('../../data/template/pt.json');
	}
	else if (lang === 'zh-cn') {
		data = require('../../data/template/zh-cn.json');
	}
	else if (lang === 'zh-tw') {
		data = require('../../data/template/zh-hk.json');
	}
	else if (lang === 'it') {
		data = require('../../data/template/it.json');
	}
	else if (lang === 'cs') {
		data = require('../../data/template/cs.json');
	}
	else if (lang === 'ru') {
		data = require('../../data/template/ru.json');
	}
	else {
		data = require('../../data/template/en.json');
	}

	resolveReferences(data);

	for (const attr of [...data.globalAttributes ?? []]) {
		if (!attr.name.startsWith('v-')) {
			data.globalAttributes?.push(
				{ ...attr, name: `:${attr.name}` },
				{ ...attr, name: `v-bind:${attr.name}` }
			);
		}
	}

	const vOn = data.globalAttributes?.find(d => d.name === 'v-on');
	const vSlot = data.globalAttributes?.find(d => d.name === 'v-slot');
	const vBind = data.globalAttributes?.find(d => d.name === 'v-bind');

	if (vOn) {
		data.globalAttributes?.push({ ...vOn, name: '@' });
	}
	if (vSlot) {
		data.globalAttributes?.push({ ...vSlot, name: '#' });
	}
	if (vBind) {
		data.globalAttributes?.push({ ...vBind, name: ':' });
	}

	return data;
}

export function loadLanguageBlocks(lang: string): html.HTMLDataV1 {

	lang = lang.toLowerCase();

	let data: html.HTMLDataV1;

	if (lang === 'ja') {
		data = require('../../data/language-blocks/ja.json');
	}
	else if (lang === 'fr') {
		data = require('../../data/language-blocks/fr.json');
	}
	else if (lang === 'ko') {
		data = require('../../data/language-blocks/ko.json');
	}
	else if (lang === 'pt-br') {
		data = require('../../data/language-blocks/pt.json');
	}
	else if (lang === 'zh-cn') {
		data = require('../../data/language-blocks/zh-cn.json');
	}
	else if (lang === 'zh-tw') {
		data = require('../../data/language-blocks/zh-hk.json');
	}
	else if (lang === 'it') {
		data = require('../../data/language-blocks/it.json');
	}
	else if (lang === 'cs') {
		data = require('../../data/language-blocks/cs.json');
	}
	else if (lang === 'ru') {
		data = require('../../data/language-blocks/ru.json');
	}
	else {
		data = require('../../data/language-blocks/en.json');
	}

	resolveReferences(data);

	return data;
}

export function loadModelModifiersData(lang: string): html.HTMLDataV1 {

	lang = lang.toLowerCase();

	let data: html.HTMLDataV1;

	if (lang === 'ja') {
		data = require('../../data/model-modifiers/ja.json');
	}
	else if (lang === 'fr') {
		data = require('../../data/model-modifiers/fr.json');
	}
	else if (lang === 'ko') {
		data = require('../../data/model-modifiers/ko.json');
	}
	else if (lang === 'pt-br') {
		data = require('../../data/model-modifiers/pt.json');
	}
	else if (lang === 'zh-cn') {
		data = require('../../data/model-modifiers/zh-cn.json');
	}
	else if (lang === 'zh-tw') {
		data = require('../../data/model-modifiers/zh-hk.json');
	}
	else if (lang === 'it') {
		data = require('../../data/model-modifiers/it.json');
	}
	else if (lang === 'cs') {
		data = require('../../data/model-modifiers/cs.json');
	}
	else if (lang === 'ru') {
		data = require('../../data/model-modifiers/ru.json');
	}
	else {
		data = require('../../data/model-modifiers/en.json');
	}

	resolveReferences(data);

	return data;
}

function resolveReferences(data: html.HTMLDataV1) {
	locale ??= require('../../data/locale.json');

	for (const item of [
		...data.globalAttributes ?? [],
		...data.tags?.flatMap(tag => [tag, ...tag.attributes]) ?? [],
	]) {
		if (typeof item.references === 'string') {
			const relativeUrl = item.references as string;
			item.references = locale.map(({ name, url }) => ({
				name,
				url: url + relativeUrl
			}));
		}
	}
}
