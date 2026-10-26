import type { LanguageServicePlugin, TextDocument } from '@volar/language-service';
import { create as baseCreate, type Provide } from 'volar-service-css';
import type * as css from 'vscode-css-languageservice';
import { resolveEmbeddedCode } from '../utils';
import { embeddedCodeIds } from '../virtualCode';

export function create({ isRenamedByTypeScript }: import('../requests').Requests): LanguageServicePlugin {
	const baseService = baseCreate({
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
				/** TypeScript navigates the class names and `v-bind()` expressions it checks. */
				async provideReferences(document, position) {
					if (await isRenamedByTypeScriptAt(document, position)) {
						return;
					}
					return worker(document, (stylesheet, cssLs) => {
						return cssLs.findReferences(document, position, stylesheet);
					});
				},
				async provideRenameRange(document, position) {
					if (await isRenamedByTypeScriptAt(document, position)) {
						return;
					}
					return worker(document, (stylesheet, cssLs) => {
						return cssLs.prepareRename(document, position, stylesheet);
					});
				},
			};

			async function isRenamedByTypeScriptAt(
				document: TextDocument,
				position: css.Position,
			) {
				const info = resolveEmbeddedCode(context, document.uri);
				if (!info?.code.id.startsWith(embeddedCodeIds.stylePrefix)) {
					return false;
				}
				const block = info.root.ir.styles.find(style => style.name === info.code.id);
				if (!block) {
					return false;
				}

				return !!await isRenamedByTypeScript(info.root.fileName, block.startTagEnd + document.offsetAt(position));
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
