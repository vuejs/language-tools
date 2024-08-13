import type { LanguageServicePlugin, LanguageServicePluginInstance } from '@volar/language-service';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { VueVirtualCode } from '@vue/language-core';
import { create as baseCreate, type Provide } from 'volar-service-css';
import * as css from 'vscode-css-languageservice';
import { URI } from 'vscode-uri';

const cssClassNameReg = /(?=(\.[a-z_][-\w]*)[\s.,+~>:#[{])/gi;
const vBindCssVarReg = /\bv-bind\(\s*(?:'([^']+)'|"([^"]+)"|([a-z_]\w+))\s*\)/gi;

export function create(): LanguageServicePlugin {
	const base = baseCreate({ scssDocumentSelector: ['scss', 'postcss'] });
	return {
		...base,
		create(context): LanguageServicePluginInstance {
			const baseInstance = base.create(context);
			const {
				'css/languageService': getCssLs,
				'css/stylesheet': getStylesheet
			} = baseInstance.provide as Provide;

			return {
				...baseInstance,
				async provideDiagnostics(document, token) {
					let diagnostics = await baseInstance.provideDiagnostics?.(document, token) ?? [];
					if (document.languageId === 'postcss') {
						diagnostics = diagnostics.filter(diag => diag.code !== 'css-semicolonexpected');
						diagnostics = diagnostics.filter(diag => diag.code !== 'css-ruleorselectorexpected');
						diagnostics = diagnostics.filter(diag => diag.code !== 'unknownAtRules');
					}
					return diagnostics;
				},
				provideRenameRange(document, position) {

					const decoded = context.decodeEmbeddedDocumentUri(URI.parse(document.uri));
					const sourceScript = decoded && context.language.scripts.get(decoded[0]);
					const virtualCode = decoded && sourceScript?.generated?.embeddedCodes.get(decoded[1]);

					const regexps: RegExp[] = [];

					if (virtualCode?.id.startsWith('style_')) {
						const i = Number(virtualCode.id.slice('style_'.length));
						if (sourceScript?.generated?.root instanceof VueVirtualCode) {
							const style = sourceScript.generated.root.sfc.styles[i];
							const option = sourceScript.generated.root.vueCompilerOptions.experimentalResolveStyleCssClasses;
							if (option === 'always' || (option === 'scoped' && style.scoped)) {
								regexps.push(cssClassNameReg);
							}
						}
					}
					regexps.push(vBindCssVarReg);

					return worker(document, (stylesheet, cssLs) => {
						const text = document.getText();
						const offset = document.offsetAt(position);

						for (const [start, end] of forEachRegExp()) {
							if (offset >= start && offset <= end) {
								return;
							}
						}
						return cssLs.prepareRename(document, position, stylesheet);

						function* forEachRegExp() {
							for (const reg of regexps) {
								for (const match of text.matchAll(reg)) {
									const matchText = match.slice(1).find(t => t);
									if (matchText) {
										const start = match.index + text.slice(match.index).indexOf(matchText)
										const end = start + matchText.length;
										yield [start, end];
									}
								}
							}
						}
					});
				}
			};

			async function worker<T>(document: TextDocument, callback: (stylesheet: css.Stylesheet, cssLs: css.LanguageService) => T) {
				const cssLs = getCssLs(document);
				if (!cssLs) {
					return;
				}
				return callback(getStylesheet(document, cssLs), cssLs);
			}
		},
	};
}
