import * as vue from '@vue/language-core';
import type * as ts from 'typescript';
import { capitalize } from '@vue/shared';
import { _getComponentNames } from './requests/componentInfos';

export function decorateLanguageServiceForVue(
	files: vue.FileRegistry,
	languageService: ts.LanguageService,
	vueOptions: vue.VueCompilerOptions,
	ts: typeof import('typescript'),
) {

	const getCompletionsAtPosition = languageService.getCompletionsAtPosition;
	const getCompletionEntryDetails = languageService.getCompletionEntryDetails;
	const getCodeFixesAtPosition = languageService.getCodeFixesAtPosition;
	const getEncodedSemanticClassifications = languageService.getEncodedSemanticClassifications;

	languageService.getCompletionsAtPosition = (fileName, position, options) => {
		const result = getCompletionsAtPosition(fileName, position, options);
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
							item.name = item.name.slice(0, -suffix.length);
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
	languageService.getEncodedSemanticClassifications = (fileName, span, format) => {
		const result = getEncodedSemanticClassifications(fileName, span, format);
		const file = files.get(fileName);
		if (
			file?.generated?.code instanceof vue.VueGeneratedCode
			&& file.generated.code.sfc.template
		) {
			const validComponentNames = _getComponentNames(ts, languageService, file.generated.code, vueOptions);
			const components = new Set([
				...validComponentNames,
				...validComponentNames.map(vue.hyphenateTag),
			]);
			const { template } = file.generated.code.sfc;
			const spanTemplateRange = [
				span.start - template.startTagEnd,
				span.start + span.length - template.startTagEnd,
			] as const;
			template.ast?.children.forEach(function visit(node) {
				if (node.loc.end.offset <= spanTemplateRange[0] || node.loc.start.offset >= spanTemplateRange[1]) {
					return;
				}
				if (node.type === 1 satisfies vue.CompilerDOM.NodeTypes.ELEMENT) {
					if (components.has(node.tag)) {
						result.spans.push(
							node.loc.start.offset + node.loc.source.indexOf(node.tag) + template.startTagEnd,
							node.tag.length,
							256, // class
						);
						if (template.lang === 'html' && !node.isSelfClosing) {
							result.spans.push(
								node.loc.start.offset + node.loc.source.lastIndexOf(node.tag) + template.startTagEnd,
								node.tag.length,
								256, // class
							);
						}
					}
					for (const child of node.children) {
						visit(child);
					}
				}
				else if (node.type === 9 satisfies vue.CompilerDOM.NodeTypes.IF) {
					for (const branch of node.branches) {
						for (const child of branch.children) {
							visit(child);
						}
					}
				}
				else if (node.type === 11 satisfies vue.CompilerDOM.NodeTypes.FOR) {
					for (const child of node.children) {
						visit(child);
					}
				}
			});
		}
		return result;
	};
}
