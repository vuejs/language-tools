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
	getScriptId: (fileName: string) => string,
) {
	const {
		getCompletionsAtPosition,
		getCompletionEntryDetails,
		getCodeFixesAtPosition,
		getEncodedSemanticClassifications,
		getQuickInfoAtPosition,
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
					for (const vueExt of vueOptions.extensions) {
						const suffix = capitalize(vueExt.slice(1)); // .vue -> Vue
						if (item.source.endsWith(vueExt) && item.name.endsWith(suffix)) {
							item.name = capitalize(item.name.slice(0, -suffix.length));
							if (item.insertText) {
								// #2286
								item.insertText = item.insertText.replace(`${suffix}$1`, '$1');
							}
							if (item.data) {
								// @ts-expect-error
								item.data.__isComponentAutoImport = {
									ext: vueExt,
									suffix,
									originalName,
									newName: item.insertText,
								};
							}
							break;
						}
					}
					if (item.data) {
						// @ts-expect-error
						item.data.__isAutoImport = {
							fileName,
						};
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
		// @ts-expect-error
		if (args[6]?.__isAutoImport) {
			// @ts-expect-error
			const { fileName } = args[6]?.__isAutoImport;
			const sourceScript = language.scripts.get(getScriptId(fileName));
			if (sourceScript?.generated?.root instanceof vue.VueVirtualCode) {
				const sfc = sourceScript.generated.root.getVueSfc();
				if (!sfc?.descriptor.script && !sfc?.descriptor.scriptSetup) {
					for (const codeAction of details?.codeActions ?? []) {
						for (const change of codeAction.changes) {
							for (const textChange of change.textChanges) {
								textChange.newText = `<script setup lang="ts">${textChange.newText}</script>\n\n`;
								break;
							}
							break;
						}
						break;
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
	languageService.getQuickInfoAtPosition = (...args) => {
		const result = getQuickInfoAtPosition(...args);
		if (result && result.documentation?.length === 1 && result.documentation[0].text.startsWith('__VLS_emit,')) {
			const [_, emitVarName, eventName] = result.documentation[0].text.split(',');
			const program = languageService.getProgram()!;
			const typeChecker = program.getTypeChecker();
			const sourceFile = program.getSourceFile(args[0]);

			result.documentation = undefined;

			let symbolNode: ts.Identifier | undefined;

			sourceFile?.forEachChild(function visit(node) {
				if (ts.isIdentifier(node) && node.text === emitVarName) {
					symbolNode = node;
				}
				if (symbolNode) {
					return;
				}
				ts.forEachChild(node, visit);
			});

			if (symbolNode) {
				const emitSymbol = typeChecker.getSymbolAtLocation(symbolNode);
				if (emitSymbol) {
					const type = typeChecker.getTypeOfSymbolAtLocation(emitSymbol, symbolNode);
					const calls = type.getCallSignatures();
					for (const call of calls) {
						const callEventName = (typeChecker.getTypeOfSymbolAtLocation(call.parameters[0], symbolNode) as ts.StringLiteralType).value;
						call.getJsDocTags();
						if (callEventName === eventName) {
							result.documentation = call.getDocumentationComment(typeChecker);
							result.tags = call.getJsDocTags();
						}
					}
				}
			}
		}
		return result;
	};
	if (isTsPlugin) {
		languageService.getEncodedSemanticClassifications = (fileName, span, format) => {
			const result = getEncodedSemanticClassifications(fileName, span, format);
			const file = language.scripts.get(getScriptId(fileName));
			if (file?.generated?.root instanceof vue.VueVirtualCode) {
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
	},
	vueCode: vue.VueVirtualCode,
	template: NonNullable<vue.VueVirtualCode['sfc']['template']>,
	spanTemplateRange: ts.TextSpan,
) {
	const { typescript: ts, languageService } = this;
	const result: ts.TextSpan[] = [];
	const validComponentNames = _getComponentNames(ts, languageService, vueCode);
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
