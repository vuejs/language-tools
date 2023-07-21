import * as html from 'vscode-html-languageservice';

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
	else if (lang === 'zh-cn') {
		data = require('../../data/template/zh-cn.json');
	}
	else {
		data = require('../../data/template/en.json');
	}

	for (const attr of [...data.globalAttributes ?? []]) {
		if (!attr.name.startsWith('v-')) {
			data.globalAttributes?.push({ ...attr, name: `:${attr.name}` });
		}
	}

	const vOn = data.globalAttributes?.find(d => d.name === 'v-on');
	const vSlot = data.globalAttributes?.find(d => d.name === 'v-slot');
	const vBind = data.globalAttributes?.find(d => d.name === 'v-bind');

	if (vOn) data.globalAttributes?.push({ ...vOn, name: '@' });
	if (vSlot) data.globalAttributes?.push({ ...vSlot, name: '#' });
	if (vBind) data.globalAttributes?.push({ ...vBind, name: ':' });

	return data;
}

export function loadLanguageBlocks(lang: string) {

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
	else if (lang === 'zh-cn') {
		data = require('../../data/language-blocks/zh-cn.json');
	}
	else {
		data = require('../../data/language-blocks/en.json');
	}

	return data;
}

export function loadModelModifiersData(lang: string) {

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
	else if (lang === 'zh-cn') {
		data = require('../../data/model-modifiers/zh-cn.json');
	}
	else {
		data = require('../../data/model-modifiers/en.json');
	}

	return data;
}
