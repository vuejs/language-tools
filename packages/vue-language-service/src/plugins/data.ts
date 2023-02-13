import * as html from 'vscode-html-languageservice';

export function loadBuiltInDirectives(lang: string) {

	lang = lang.toLowerCase();

	let json: html.IAttributeData[];

	if (lang === 'ja') {
		json = require('../../data/built-in-directives/ja.json');
	}
	else if (lang === 'ua') {
		json = require('../../data/built-in-directives/ua.json');
	}
	else if (lang === 'fr') {
		json = require('../../data/built-in-directives/fr.json');
	}
	else if (lang.startsWith('zh-')) {
		json = require('../../data/built-in-directives/zh-cn.json');
	}
	else {
		json = require('../../data/built-in-directives/en.json');
	}

	const data = [...json];
	const vOn = json.find(d => d.name === 'v-on');
	const vSlot = json.find(d => d.name === 'v-slot');
	const vBind = json.find(d => d.name === 'v-bind');

	if (vOn) data.push({ ...vOn, name: '@' });
	if (vSlot) data.push({ ...vSlot, name: '#' });
	if (vBind) data.push({ ...vBind, name: ':' });

	return data;
}

export function loadLanguageBlocks(lang: string) {

	lang = lang.toLowerCase();

	let json: html.HTMLDataV1;

	if (lang === 'ja') {
		json = require('../../data/language-blocks/ja.json');
	}
	else if (lang === 'ua') {
		json = require('../../data/language-blocks/ua.json');
	}
	else if (lang === 'fr') {
		json = require('../../data/language-blocks/fr.json');
	}
	else if (lang.startsWith('zh-')) {
		json = require('../../data/language-blocks/zh-cn.json');
	}
	else {
		json = require('../../data/language-blocks/en.json');
	}

	return json;
}
