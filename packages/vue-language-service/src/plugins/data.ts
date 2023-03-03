import * as html from 'vscode-html-languageservice';

const dataMap: Record<string, string> = {
	en: 'en', 
	fr: 'fr',  
	ja: 'ja', 
	ko: 'ko', 
	'zh-cn': 'zn-cn', 
	'zh-tw': 'zh-tw',
};

export function loadTemplateData(lang: string) {

	lang = lang.toLowerCase();

	let data: html.HTMLDataV1 = require(`../../data/template/${dataMap[lang] ?? 'en'}.json`)

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

	let data: html.HTMLDataV1 = require(`../../data/language-blocks/${dataMap[lang] ?? 'en'}.json`)

	return data;
}

export function loadModelModifiersData(lang: string) {

	lang = lang.toLowerCase();

	let data: html.HTMLDataV1 = require(`../../data/model-modifiers/${dataMap[lang] ?? 'en'}.json`)

	return data;
}
