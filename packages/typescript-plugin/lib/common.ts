import * as vue from '@vue/language-core';
import type * as ts from 'typescript';
import { capitalize } from '@vue/shared';
import { _getComponentNames } from './requests/componentInfos';

export function decorateLanguageServiceForVue(
	language: vue.Language,
	languageService: ts.LanguageService,
	vueOptions: vue.VueCompilerOptions,
	ts: typeof import('typescript'),
	isTsPlugin: boolean,
) {
	const {
		getCompletionsAtPosition,
		getCompletionEntryDetails,
		getCodeFixesAtPosition,
		getEncodedSemanticClassifications,
	} = languageService;

	languageService.getCompletionsAtPosition = (fileName, position, options, formattingSettings) => {
		const result = getCompletionsAtPosition(fileName, position, options, formattingSettings);
		if (result) {
			// filter __VLS_
			result.entries = result.entries.filter(
				entry => entry.name.indexOf('__VLS_') === -1
					&& (!entry.labelDetails?.description || entry.labelDetails.description.indexOf('__VLS_') === -1)
			);
			// modify label
			for (const item of result.entries) {
				if (item.source) {
					const originalName = item.name;
					for (const ext of vueOptions.extensions) {
						const suffix = capitalize(ext.substring('.'.length)); // .vue -> Vue
						if (item.source.endsWith(ext) && item.name.endsWith(suffix)) {
							item.name = capitalize(item.name.slice(0, -suffix.length));
							if (item.insertText) {
								// #2286
								item.insertText = item.insertText.replace(`${suffix}$1`, '$1');
							}
							if (item.data) {
								// @ts-expect-error
								item.data.__isComponentAutoImport = {
									ext,
									suffix,
									originalName,
									newName: item.insertText,
								};
							}
							break;
						}
					}
				}
			}
		}
		return result;
	};
	languageService.getCompletionEntryDetails = (...args) => {
		const details = getCompletionEntryDetails(...args);
		// modify import statement
		// @ts-expect-error
		if (args[6]?.__isComponentAutoImport) {
			// @ts-expect-error
			const { ext, suffix, originalName, newName } = args[6]?.__isComponentAutoImport;
			for (const codeAction of details?.codeActions ?? []) {
				for (const change of codeAction.changes) {
					for (const textChange of change.textChanges) {
						textChange.newText = textChange.newText.replace('import ' + originalName + ' from ', 'import ' + newName + ' from ');
					}
				}
			}
		}
		return details;
	};
	languageService.getCodeFixesAtPosition = (...args) => {
		let result = getCodeFixesAtPosition(...args);
		// filter __VLS_
		result = result.filter(entry => entry.description.indexOf('__VLS_') === -1);
		return result;
	};
	if (isTsPlugin) {
		languageService.getEncodedSemanticClassifications = (fileName, span, format) => {
			const result = getEncodedSemanticClassifications(fileName, span, format);
			const file = language.scripts.get(fileName);
			if (file?.generated?.root instanceof vue.VueGeneratedCode) {
				const { template } = file.generated.root.sfc;
				if (template) {
					for (const componentSpan of getComponentSpans.call(
						{ typescript: ts, languageService, vueOptions },
						file.generated.root,
						template,
						{
							start: span.start - template.startTagEnd,
							length: span.length,
						},
					)) {
						result.spans.push(
							componentSpan.start + template.startTagEnd,
							componentSpan.length,
							256, // class
						);
					}
				}
			}
			return result;
		};
	}
}

export function getComponentSpans(
	this: {
		typescript: typeof import('typescript');
		languageService: ts.LanguageService;
		vueOptions: vue.VueCompilerOptions;
	},
	vueCode: vue.VueGeneratedCode,
	template: NonNullable<vue.VueGeneratedCode['sfc']['template']>,
	spanTemplateRange: ts.TextSpan,
) {
	const { typescript: ts, languageService, vueOptions } = this;
	const result: ts.TextSpan[] = [];
	const validComponentNames = _getComponentNames(ts, languageService, vueCode, vueOptions);
	const components = new Set([
		...validComponentNames,
		...validComponentNames.map(vue.hyphenateTag),
	]);
	if (template.ast) {
		for (const node of vue.forEachElementNode(template.ast)) {
			if (node.loc.end.offset <= spanTemplateRange.start || node.loc.start.offset >= (spanTemplateRange.start + spanTemplateRange.length)) {
				continue;
			}
			if (components.has(node.tag)) {
				let start = node.loc.start.offset;
				if (template.lang === 'html') {
					start += '<'.length;
				}
				result.push({
					start,
					length: node.tag.length,
				});
				if (template.lang === 'html' && !node.isSelfClosing) {
					result.push({
						start: node.loc.start.offset + node.loc.source.lastIndexOf(node.tag),
						length: node.tag.length,
					});
				}
			}
		}
	}
	return result;
}
