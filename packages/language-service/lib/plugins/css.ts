import type { LanguageServicePlugin, TextDocument, VirtualCode } from '@volar/language-service';
import { isRenameEnabled } from '@vue/language-core';
import { create as baseCreate, type Provide } from 'volar-service-css';
import type * as css from 'vscode-css-languageservice';
import { getEmbeddedInfo } from '../utils';

export function create(): LanguageServicePlugin {
	const base = baseCreate({ scssDocumentSelector: ['scss', 'postcss'] });
	return {
		...base,
		create(context) {
			const baseInstance = base.create(context);
			const {
				'css/languageService': getCssLs,
				'css/stylesheet': getStylesheet,
			} = baseInstance.provide as Provide;

			return {
				...baseInstance,
				async provideDiagnostics(document, token) {
					let diagnostics = await baseInstance.provideDiagnostics?.(document, token) ?? [];
					if (document.languageId === 'postcss') {
						diagnostics = diagnostics.filter(diag =>
							diag.code !== 'css-semicolonexpected'
							&& diag.code !== 'css-ruleorselectorexpected'
							&& diag.code !== 'unknownAtRules'
						);
					}
					return diagnostics;
				},
				/**
				 * If the position is within the virtual code and navigation is enabled,
				 * skip the CSS navigation feature.
				 */
				provideReferences(document, position) {
					if (isWithinNavigationVirtualCode(document, position)) {
						return;
					}
					return worker(document, (stylesheet, cssLs) => {
						return cssLs.findReferences(document, position, stylesheet);
					});
				},
				provideRenameRange(document, position) {
					if (isWithinNavigationVirtualCode(document, position)) {
						return;
					}
					return worker(document, (stylesheet, cssLs) => {
						return cssLs.prepareRename(document, position, stylesheet);
					});
				},
			};

			function isWithinNavigationVirtualCode(
				document: TextDocument,
				position: css.Position,
			) {
				const info = getEmbeddedInfo(context, document, id => id.startsWith('style_'));
				if (!info) {
					return false;
				}
				const { sourceScript, virtualCode, root } = info;

				const block = root.sfc.styles.find(style => style.name === virtualCode.id);
				if (!block) {
					return false;
				}

				let script: VirtualCode | undefined;
				for (const [key, value] of sourceScript.generated.embeddedCodes) {
					if (key.startsWith('script_')) {
						script = value;
						break;
					}
				}
				if (!script) {
					return false;
				}

				const offset = document.offsetAt(position) + block.startTagEnd;
				for (const { sourceOffsets, lengths, data } of script.mappings) {
					if (!sourceOffsets.length || !isRenameEnabled(data)) {
						continue;
					}

					const start = sourceOffsets[0];
					const end = sourceOffsets.at(-1)! + lengths.at(-1)!;

					if (offset >= start && offset <= end) {
						return true;
					}
				}
				return false;
			}

			function worker<T>(
				document: TextDocument,
				callback: (stylesheet: css.Stylesheet, cssLs: css.LanguageService) => T,
			) {
				const cssLs = getCssLs(document);
				if (!cssLs) {
					return;
				}
				return callback(getStylesheet(document, cssLs), cssLs);
			}
		},
	};
}
