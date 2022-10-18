import type { LanguageServicePlugin, LanguageServicePluginContext } from '@volar/language-service';
import * as shared from '@volar/shared';
import * as css from 'vscode-css-languageservice';
import * as vscode from 'vscode-languageserver-protocol';
import { TextDocument } from 'vscode-languageserver-textdocument';
import * as path from 'path';

const wordPatterns: { [lang: string]: RegExp; } = {
	css: /(#?-?\d*\.\d\w*%?)|(::?[\w-]*(?=[^,{;]*[,{]))|(([@#.!])?[\w-?]+%?|[@#!.])/g,
	less: /(#?-?\d*\.\d\w*%?)|(::?[\w-]+(?=[^,{;]*[,{]))|(([@#.!])?[\w-?]+%?|[@#!.])/g,
	scss: /(#?-?\d*\.\d\w*%?)|(::?[\w-]*(?=[^,{;]*[,{]))|(([@$#.!])?[\w-?]+%?|[@#!$.])/g,
	postcss: /(#?-?\d*\.\d\w*%?)|(::?[\w-]*(?=[^,{;]*[,{]))|(([@$#.!])?[\w-?]+%?|[@#!$.])/g, // scss
};

export default function (): LanguageServicePlugin {

	const stylesheets = new WeakMap<TextDocument, [number, css.Stylesheet]>();

	let inited = false;
	let context: LanguageServicePluginContext;
	let cssLs: css.LanguageService;
	let scssLs: css.LanguageService;
	let lessLs: css.LanguageService;
	let postcssLs: css.LanguageService;

	return {

		setup(_context) {
			context = _context;
			cssLs = css.getCSSLanguageService({ fileSystemProvider: _context.env.fileSystemProvider });
			scssLs = css.getSCSSLanguageService({ fileSystemProvider: _context.env.fileSystemProvider });
			lessLs = css.getLESSLanguageService({ fileSystemProvider: _context.env.fileSystemProvider });
			postcssLs = {
				...scssLs,
				doValidation: (document, stylesheet, documentSettings) => {
					let errors = scssLs.doValidation(document, stylesheet, documentSettings);
					errors = errors.filter(error => error.code !== 'css-semicolonexpected');
					errors = errors.filter(error => error.code !== 'css-ruleorselectorexpected');
					errors = errors.filter(error => error.code !== 'unknownAtRules');
					return errors;
				},
			};
		},

		complete: {

			// https://github.com/microsoft/vscode/blob/09850876e652688fb142e2e19fd00fd38c0bc4ba/extensions/css-language-features/server/src/cssServer.ts#L97
			triggerCharacters: ['/', '-', ':'],

			async on(document, position) {
				return worker(document, async (stylesheet, cssLs) => {

					if (!context.env.documentContext)
						return;

					const wordPattern = wordPatterns[document.languageId] ?? wordPatterns.css;
					const wordStart = shared.getWordRange(wordPattern, position, document)?.start; // TODO: use end?
					const wordRange = vscode.Range.create(wordStart ?? position, position);
					const settings = await context.env.configurationHost?.getConfiguration<css.LanguageSettings>(document.languageId, document.uri);
					const cssResult = await cssLs.doComplete2(document, position, stylesheet, context.env.documentContext, settings?.completion);

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

		validation: {
			async onSyntactic(document) {
				return worker(document, async (stylesheet, cssLs) => {

					const settings = await context.env.configurationHost?.getConfiguration<css.LanguageSettings>(document.languageId, document.uri);

					return cssLs.doValidation(document, stylesheet, settings) as vscode.Diagnostic[];
				});
			},
		},

		async doHover(document, position) {
			return worker(document, async (stylesheet, cssLs) => {

				const settings = await context.env.configurationHost?.getConfiguration<css.LanguageSettings>(document.languageId, document.uri);

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

				if (!context.env.documentContext)
					return;

				return cssLs.findDocumentLinks(document, stylesheet, context.env.documentContext);
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

				const options_2 = await context.env.configurationHost?.getConfiguration<css.CSSFormatConfiguration & { enable: boolean; }>(document.languageId + '.format', document.uri);

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

			context.env.configurationHost?.onDidChangeConfiguration(async () => {
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

		const configHost = context.env.configurationHost;

		if (configHost) {

			const customData: string[] = await configHost.getConfiguration('css.customData') ?? [];
			const newData: css.ICSSDataProvider[] = [];

			for (const customDataPath of customData) {
				try {
					const jsonPath = path.resolve(customDataPath);
					newData.push(css.newCSSDataProvider(require(jsonPath)));
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
