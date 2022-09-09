import { EmbeddedLanguageServicePlugin, useConfigurationHost, useDocumentContext, useFileSystemProvider, useRootUri } from '@volar/embedded-language-service';
import * as shared from '@volar/shared';
import * as css from 'vscode-css-languageservice';
import * as vscode from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';

const wordPatterns: { [lang: string]: RegExp; } = {
	css: /(#?-?\d*\.\d\w*%?)|(::?[\w-]*(?=[^,{;]*[,{]))|(([@#.!])?[\w-?]+%?|[@#!.])/g,
	less: /(#?-?\d*\.\d\w*%?)|(::?[\w-]+(?=[^,{;]*[,{]))|(([@#.!])?[\w-?]+%?|[@#!.])/g,
	scss: /(#?-?\d*\.\d\w*%?)|(::?[\w-]*(?=[^,{;]*[,{]))|(([@$#.!])?[\w-?]+%?|[@#!$.])/g,
	postcss: /(#?-?\d*\.\d\w*%?)|(::?[\w-]*(?=[^,{;]*[,{]))|(([@$#.!])?[\w-?]+%?|[@#!$.])/g, // scss
};

export default function (): EmbeddedLanguageServicePlugin {

	const fileSystemProvider = useFileSystemProvider();
	const documentContext = useDocumentContext();

	const cssLs = css.getCSSLanguageService({ fileSystemProvider });
	const scssLs = css.getSCSSLanguageService({ fileSystemProvider });
	const lessLs = css.getLESSLanguageService({ fileSystemProvider });
	const postcssLs: css.LanguageService = {
		...scssLs,
		doValidation: (document, stylesheet, documentSettings) => {
			let errors = scssLs.doValidation(document, stylesheet, documentSettings);
			errors = errors.filter(error => error.code !== 'css-semicolonexpected');
			errors = errors.filter(error => error.code !== 'css-ruleorselectorexpected');
			errors = errors.filter(error => error.code !== 'unknownAtRules');
			return errors;
		},
	};
	const stylesheets = new WeakMap<TextDocument, [number, css.Stylesheet]>();

	let inited = false;

	return {

		complete: {

			// https://github.com/microsoft/vscode/blob/09850876e652688fb142e2e19fd00fd38c0bc4ba/extensions/css-language-features/server/src/cssServer.ts#L97
			triggerCharacters: ['/', '-', ':'],

			async on(document, position, context) {
				return worker(document, async (stylesheet, cssLs) => {

					if (!documentContext)
						return;

					const wordPattern = wordPatterns[document.languageId] ?? wordPatterns.css;
					const wordStart = shared.getWordRange(wordPattern, position, document)?.start; // TODO: use end?
					const wordRange = vscode.Range.create(wordStart ?? position, position);
					const settings = await useConfigurationHost()?.getConfiguration<css.LanguageSettings>(document.languageId, document.uri);
					const cssResult = await cssLs.doComplete2(document, position, stylesheet, documentContext, settings?.completion);

					if (cssResult) {
						for (const item of cssResult.items) {

							if (item.textEdit)
								continue;

							// track https://github.com/microsoft/vscode-css-languageservice/issues/265
							const newText = item.insertText || item.label;
							item.textEdit = vscode.TextEdit.replace(wordRange, newText);
						}
					}

					return cssResult;
				});
			},
		},

		rename: {

			prepare(document, position) {
				return worker(document, (stylesheet, cssLs) => {

					const wordPattern = wordPatterns[document.languageId] ?? wordPatterns.css;
					const wordRange = shared.getWordRange(wordPattern, position, document);

					return wordRange;
				});
			},

			on(document, position, newName) {
				return worker(document, (stylesheet, cssLs) => {
					return cssLs.doRename(document, position, newName, stylesheet);
				});
			},
		},

		codeAction: {

			on(document, range, context) {
				return worker(document, (stylesheet, cssLs) => {
					return cssLs.doCodeActions2(document, range, context, stylesheet) as vscode.CodeAction[];
				});
			},
		},

		definition: {

			on(document, position) {
				return worker(document, (stylesheet, cssLs) => {

					const location = cssLs.findDefinition(document, position, stylesheet);

					if (location) {
						return [vscode.LocationLink.create(location.uri, location.range, location.range)];
					}
				});
			},
		},

		async doValidation(document) {
			return worker(document, async (stylesheet, cssLs) => {

				const settings = await useConfigurationHost()?.getConfiguration<css.LanguageSettings>(document.languageId, document.uri);

				return cssLs.doValidation(document, stylesheet, settings) as vscode.Diagnostic[];
			});
		},

		async doHover(document, position) {
			return worker(document, async (stylesheet, cssLs) => {

				const settings = await useConfigurationHost()?.getConfiguration<css.LanguageSettings>(document.languageId, document.uri);

				return cssLs.doHover(document, position, stylesheet, settings?.hover);
			});
		},

		findReferences(document, position) {
			return worker(document, (stylesheet, cssLs) => {
				return cssLs.findReferences(document, position, stylesheet);
			});
		},

		findDocumentHighlights(document, position) {
			return worker(document, (stylesheet, cssLs) => {
				return cssLs.findDocumentHighlights(document, position, stylesheet);
			});
		},

		findDocumentLinks(document) {
			return worker(document, (stylesheet, cssLs) => {

				if (!documentContext)
					return;

				return cssLs.findDocumentLinks(document, stylesheet, documentContext);
			});
		},

		findDocumentSymbols(document) {
			return worker(document, (stylesheet, cssLs) => {
				return cssLs.findDocumentSymbols(document, stylesheet);
			});
		},

		findDocumentColors(document) {
			return worker(document, (stylesheet, cssLs) => {
				return cssLs.findDocumentColors(document, stylesheet);
			});
		},

		getColorPresentations(document, color, range) {
			return worker(document, (stylesheet, cssLs) => {
				return cssLs.getColorPresentations(document, stylesheet, color, range);
			});
		},

		getFoldingRanges(document) {
			return worker(document, (stylesheet, cssLs) => {
				return cssLs.getFoldingRanges(document, stylesheet);
			});
		},

		getSelectionRanges(document, positions) {
			return worker(document, (stylesheet, cssLs) => {
				return cssLs.getSelectionRanges(document, positions, stylesheet);
			});
		},

		async format(document, range, options) {
			return worker(document, async (stylesheet, cssLs) => {

				const options_2 = await useConfigurationHost()?.getConfiguration<css.CSSFormatConfiguration & { enable: boolean; }>(document.languageId + '.format', document.uri);

				if (options_2?.enable === false) {
					return;
				}

				const edits = cssLs.format(document, range, {
					...options_2,
					...options,
				});

				const newText = TextDocument.applyEdits(document, edits);

				return [{
					newText: '\n' + newText.trim() + '\n',
					range: {
						start: document.positionAt(0),
						end: document.positionAt(document.getText().length),
					},
				}];
			});
		},
	};

	async function initCustomData() {
		if (!inited) {

			useConfigurationHost()?.onDidChangeConfiguration(async () => {
				const customData = await getCustomData();
				cssLs.setDataProviders(true, customData);
				scssLs.setDataProviders(true, customData);
				lessLs.setDataProviders(true, customData);
			});

			const customData = await getCustomData();
			cssLs.setDataProviders(true, customData);
			scssLs.setDataProviders(true, customData);
			lessLs.setDataProviders(true, customData);
			inited = true;
		}
	}

	async function getCustomData() {

		const configHost = useConfigurationHost();

		if (configHost) {

			const paths = new Set<string>();
			const customData: string[] = await configHost.getConfiguration('css.customData') ?? [];
			const rootPath = shared.getPathOfUri(useRootUri());

			for (const customDataPath of customData) {
				try {
					const jsonPath = require.resolve(customDataPath, { paths: [rootPath] });
					paths.add(jsonPath);
				}
				catch (error) {
					console.error(error);
				}
			}

			const newData: css.ICSSDataProvider[] = [];

			for (const path of paths) {
				try {
					newData.push(css.newCSSDataProvider(require(path)));
				}
				catch (error) {
					console.error(error);
				}
			}

			return newData;
		}

		return [];
	}

	function getCssLs(lang: string) {
		switch (lang) {
			case 'css': return cssLs;
			case 'scss': return scssLs;
			case 'less': return lessLs;
			case 'postcss': return postcssLs;
		}
	}

	function getStylesheet(document: TextDocument) {

		const cache = stylesheets.get(document);
		if (cache) {
			const [cacheVersion, cacheStylesheet] = cache;
			if (cacheVersion === document.version) {
				return cacheStylesheet;
			}
		}

		const cssLs = getCssLs(document.languageId);
		if (!cssLs)
			return;

		const stylesheet = cssLs.parseStylesheet(document);
		stylesheets.set(document, [document.version, stylesheet]);

		return stylesheet;
	}

	async function worker<T>(document: TextDocument, callback: (stylesheet: css.Stylesheet, cssLs: css.LanguageService) => T) {

		const stylesheet = getStylesheet(document);
		if (!stylesheet)
			return;

		const cssLs = getCssLs(document.languageId);
		if (!cssLs)
			return;

		await initCustomData();

		return callback(stylesheet, cssLs);
	}
};
