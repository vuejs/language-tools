import type * as html from 'vscode-html-languageservice';

export interface SfcBlock {
	start: number;
	end: number;
	lang: string;
	content: string;
	startTagEnd: number;
	attrs: Record<string, string>,
}

export interface Sfc {
	template: SfcBlock | null;
	script: (SfcBlock & {
		src: string | undefined;
	}) | null;
	scriptSetup: SfcBlock | null;
	styles: (SfcBlock & {
		module: string | undefined;
		scoped: boolean;
	})[];
	customBlocks: (SfcBlock & {
		type: string;
	})[];
}

export const defaultLanguages = {
	template: 'html',
	script: 'js',
	style: 'css',
};

const validScriptSyntaxs = ['js', 'jsx', 'ts', 'tsx'] as const;

type ValidScriptSyntax = typeof validScriptSyntaxs[number];

function getValidScriptSyntax(syntax: string): ValidScriptSyntax {
	if (validScriptSyntaxs.includes(syntax as ValidScriptSyntax)) {
		return syntax as ValidScriptSyntax;
	}
	return 'js';
}

export function parseSfc(text: string, doc: html.HTMLDocument) {

	const sfc: Sfc = {
		template: null,
		script: null,
		scriptSetup: null,
		styles: [],
		customBlocks: [],
	};

	for (const node of doc.roots) {

		const lang = node.attributes?.['lang'];

		if (node.tag === 'template' && node.startTagEnd !== undefined) {
			sfc.template = {
				lang: lang !== undefined ? parseAttr(lang, defaultLanguages.template) : defaultLanguages.template,
				content: text.substring(node.startTagEnd, node.endTagStart),
				startTagEnd: node.startTagEnd,
				start: node.start,
				end: node.end,
				attrs: parseAttrs(node.attributes),
			};
		}
		else if (node.tag === 'script' && node.startTagEnd !== undefined) {
			if (node.attributes?.['setup'] === undefined) {

				const src = node.attributes?.['src'];

				sfc.script = {
					src: src !== undefined ? parseAttr(src, '') : undefined,
					lang: lang !== undefined ? getValidScriptSyntax(parseAttr(lang, defaultLanguages.script)) : defaultLanguages.script,
					content: text.substring(node.startTagEnd, node.endTagStart),
					startTagEnd: node.startTagEnd,
					start: node.start,
					end: node.end,
					attrs: parseAttrs(node.attributes),
				};
			}
			else {
				sfc.scriptSetup = {
					lang: lang !== undefined ? getValidScriptSyntax(parseAttr(lang, defaultLanguages.script)) : defaultLanguages.script,
					content: text.substring(node.startTagEnd, node.endTagStart),
					startTagEnd: node.startTagEnd,
					start: node.start,
					end: node.end,
					attrs: parseAttrs(node.attributes),
				};
			}
		}
		else if (node.tag === 'style' && node.startTagEnd !== undefined) {

			const module = node.attributes?.['module'];
			const scoped = node.attributes?.['scoped'];

			sfc.styles.push({
				lang: lang !== undefined ? parseAttr(lang, defaultLanguages.style) : defaultLanguages.style,
				content: text.substring(node.startTagEnd, node.endTagStart),
				startTagEnd: node.startTagEnd,
				start: node.start,
				end: node.end,
				module: module !== undefined ? parseAttr(module, '$style') : undefined,
				scoped: scoped !== undefined,
				attrs: parseAttrs(node.attributes),
			});
		}
		else {
			sfc.customBlocks.push({
				type: node.tag ?? '',
				lang: lang !== undefined ? parseAttr(lang, '') : '',
				content: node.startTagEnd !== undefined ? text.substring(node.startTagEnd, node.endTagStart) : '',
				startTagEnd: node.startTagEnd ?? node.end,
				start: node.start,
				end: node.end,
				attrs: parseAttrs(node.attributes),
			});
		}

		function parseAttrs(attrs: typeof node.attributes) {
			const obj: Record<string, string> = {};
			if (attrs) {
				for (let key in attrs) {
					obj[key] = parseAttr(attrs[key], '');
				}
			}
			return obj;
		}
	}

	return sfc;
}
function parseAttr(attr: string | null, _default: string): string {
	if (attr === null) {
		return _default;
	}
	if (
		(attr.startsWith('"') && attr.endsWith('"'))
		|| (attr.startsWith("'") && attr.endsWith("'"))
	) {
		return attr.substring(1, attr.length - 1);
	}
	return attr;
}
