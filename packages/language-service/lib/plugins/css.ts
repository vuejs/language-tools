import type { LanguageServicePlugin, TextDocument, VirtualCode } from '@volar/language-service';
import { isRenameEnabled } from '@vue/language-core';
import { create as baseCreate, type Provide, resolveReference } from 'volar-service-css';
import type * as css from 'vscode-css-languageservice';
import { URI } from 'vscode-uri';
import { resolveEmbeddedCode } from '../utils';

export function create(
	{ resolveModuleName }: import('@vue/typescript-plugin/lib/requests').Requests,
): LanguageServicePlugin {
	let modulePathCache:
		| Map<string, Promise<string | null | undefined> | string | null | undefined>
		| undefined;

	const baseService = baseCreate({
		getDocumentContext(context) {
			return {
				resolveReference(ref, base) {
					let baseUri = URI.parse(base);
					const decoded = context.decodeEmbeddedDocumentUri(baseUri);
					if (decoded) {
						baseUri = decoded[0];
					}
					if (
						modulePathCache
						&& baseUri.scheme === 'file'
						&& !ref.startsWith('./')
						&& !ref.startsWith('../')
					) {
						const map = modulePathCache;
						if (!map.has(ref)) {
							const fileName = baseUri.fsPath.replace(/\\/g, '/');
							const promise = resolveModuleName(fileName, ref);
							map.set(ref, promise);
							if (promise instanceof Promise) {
								promise.then(res => map.set(ref, res));
							}
						}
						const cached = modulePathCache.get(ref);
						if (cached instanceof Promise) {
							throw cached;
						}
						if (cached) {
							return cached;
						}
					}
					return resolveReference(ref, baseUri, context.env.workspaceFolders);
				},
			};
		},
		scssDocumentSelector: ['scss', 'postcss'],
	});
	return {
		...baseService,
		create(context) {
			const baseServiceInstance = baseService.create(context);
			const {
				'css/languageService': getCssLs,
				'css/stylesheet': getStylesheet,
			} = baseServiceInstance.provide as Provide;

			return {
				...baseServiceInstance,
				async provideDiagnostics(document, token) {
					let diagnostics = await baseServiceInstance.provideDiagnostics?.(document, token) ?? [];
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
				async provideDocumentLinks(document, token) {
					modulePathCache = new Map();
					while (true) {
						try {
							const result = await baseServiceInstance.provideDocumentLinks?.(document, token);
							modulePathCache = undefined;
							return result;
						}
						catch (e) {
							if (e instanceof Promise) {
								await e;
							}
							else {
								throw e;
							}
						}
					}
				},
			};

			function isWithinNavigationVirtualCode(
				document: TextDocument,
				position: css.Position,
			) {
				const info = resolveEmbeddedCode(context, document.uri);
				if (!info?.code.id.startsWith('style_')) {
					return false;
				}
				const block = info.root.sfc.styles.find(style => style.name === info.code.id);
				if (!block) {
					return false;
				}

				let script: VirtualCode | undefined;
				for (const [key, value] of info.script.generated.embeddedCodes) {
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

					const start = sourceOffsets[0]!;
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
