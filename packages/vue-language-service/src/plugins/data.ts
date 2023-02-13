import * as html from 'vscode-html-languageservice';

export function loadTemplateData(lang: string) {

	lang = lang.toLowerCase();

	let data: html.HTMLDataV1;

	if (lang === 'ja') {
		data = require('../../data/template/ja.json');
	}
	else if (lang === 'ua') {
		data = require('../../data/template/ua.json');
	}
	else if (lang === 'fr') {
		data = require('../../data/template/fr.json');
	}
	else if (lang === 'zh-cn') {
		data = require('../../data/template/zh-cn.json');
	}
	else if (lang === 'zh-tw') {
		data = require('../../data/template/zh-tw.json');
	}
	else {
		data = require('../../data/template/en.json');
	}

	const vOn = data.globalAttributes?.find(d => d.name === 'v-on');
	const vSlot = data.globalAttributes?.find(d => d.name === 'v-slot');
	const vBind = data.globalAttributes?.find(d => d.name === 'v-bind');

	if (vOn) data.globalAttributes?.push({ ...vOn, name: '@' });
	if (vSlot) data.globalAttributes?.push({ ...vSlot, name: '#' });
	if (vBind) data.globalAttributes?.push({ ...vBind, name: ':' });

	for (const attr of [...data.globalAttributes ?? []]) {
		if (!attr.name.startsWith('v-')) {
			data.globalAttributes?.push({ ...attr, name: `:${attr.name}` });
		}
	}

	return data;
}

export function loadLanguageBlocks(lang: string) {

	lang = lang.toLowerCase();

	let data: html.HTMLDataV1;

	if (lang === 'ja') {
		data = require('../../data/language-blocks/ja.json');
	}
	else if (lang === 'ua') {
		data = require('../../data/language-blocks/ua.json');
	}
	else if (lang === 'fr') {
		data = require('../../data/language-blocks/fr.json');
	}
	else if (lang === 'zh-cn') {
		data = require('../../data/language-blocks/zh-cn.json');
	}
	else if (lang === 'zh-tw') {
		data = require('../../data/language-blocks/zh-tw.json');
	}
	else {
		data = require('../../data/language-blocks/en.json');
	}

	return data;
}
