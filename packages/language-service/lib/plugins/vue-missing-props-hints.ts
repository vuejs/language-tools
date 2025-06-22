import type {
	InlayHint,
	InlayHintKind,
	LanguageServiceContext,
	LanguageServicePlugin,
	TextDocument,
} from '@volar/language-service';
import { hyphenateAttr, hyphenateTag, VueVirtualCode } from '@vue/language-core';
import * as html from 'vscode-html-languageservice';
import { URI } from 'vscode-uri';
import { AttrNameCasing, checkCasing } from '../nameCasing';

export function create(
	getTsPluginClient?: (
		context: LanguageServiceContext,
	) => import('@vue/typescript-plugin/lib/requests').Requests | undefined,
): LanguageServicePlugin {
	return {
		name: 'vue-missing-props-hints',
		capabilities: {
			inlayHintProvider: {},
		},
		create(context) {
			const tsPluginClient = getTsPluginClient?.(context);
			let intrinsicElementNames: Set<string>;

			return {
				async provideInlayHints(document, range, cancellationToken) {
					if (!isSupportedDocument(document)) {
						return;
					}

					if (!context.project.vue) {
						return;
					}

					const enabled = await context.env.getConfiguration<boolean>?.('vue.inlayHints.missingProps') ?? false;
					if (!enabled) {
						return;
					}

					const uri = URI.parse(document.uri);
					const decoded = context.decodeEmbeddedDocumentUri(uri);
					const sourceScript = decoded && context.language.scripts.get(decoded[0]);
					const virtualCode = decoded && sourceScript?.generated?.embeddedCodes.get(decoded[1]);
					if (!virtualCode) {
						return;
					}

					const root = sourceScript?.generated?.root;
					if (!(root instanceof VueVirtualCode)) {
						return;
					}

					const scanner = getScanner(context, document);
					if (!scanner) {
						return;
					}

					const result: InlayHint[] = [];
					const casing = await checkCasing(context, decoded[0]);
					const components = await tsPluginClient?.getComponentNames(root.fileName) ?? [];
					const componentProps: Record<string, string[]> = {};

					intrinsicElementNames ??= new Set(
						await tsPluginClient?.getElementNames(root.fileName) ?? [],
					);

					let token: html.TokenType;
					let current: {
						unburnedRequiredProps: string[];
						labelOffset: number;
					} | undefined;

					while ((token = scanner.scan()) !== html.TokenType.EOS) {
						if (token === html.TokenType.StartTag) {
							const tagName = scanner.getTokenText();
							const tagOffset = scanner.getTokenOffset();
							const checkTag = tagName.includes('.')
								? tagName
								: components.find(component => component === tagName || hyphenateTag(component) === tagName);

							if (intrinsicElementNames.has(tagName) || !checkTag) {
								continue;
							}
							if (tagOffset < document.offsetAt(range.start)) {
								continue;
							}
							if (tagOffset > document.offsetAt(range.end)) {
								break;
							}

							if (!componentProps[checkTag]) {
								if (cancellationToken.isCancellationRequested) {
									break;
								}
								componentProps[checkTag] = (await tsPluginClient?.getComponentProps(root.fileName, checkTag) ?? [])
									.filter(prop => prop.required)
									.map(prop => prop.name);
							}

							current = {
								unburnedRequiredProps: [...componentProps[checkTag]],
								labelOffset: scanner.getTokenOffset() + scanner.getTokenLength(),
							};
						} else if (token === html.TokenType.AttributeName) {
							if (current) {
								let attrText = scanner.getTokenText();

								if (attrText === 'v-bind') {
									current.unburnedRequiredProps = [];
								} else {
									// remove modifiers
									if (attrText.includes('.')) {
										attrText = attrText.split('.')[0];
									}
									// normalize
									if (attrText.startsWith('v-bind:')) {
										attrText = attrText.slice('v-bind:'.length);
									} else if (attrText.startsWith(':')) {
										attrText = attrText.slice(':'.length);
									} else if (attrText.startsWith('v-model:')) {
										attrText = attrText.slice('v-model:'.length);
									} else if (attrText === 'v-model') {
										attrText = 'modelValue'; // TODO: support for experimentalModelPropName?
									} else if (attrText.startsWith('v-on:')) {
										attrText = 'on-' + hyphenateAttr(attrText.slice('v-on:'.length));
									} else if (attrText.startsWith('@')) {
										attrText = 'on-' + hyphenateAttr(attrText.slice('@'.length));
									}

									current.unburnedRequiredProps = current.unburnedRequiredProps.filter(propName => {
										return attrText !== propName
											&& attrText !== hyphenateAttr(propName);
									});
								}
							}
						} else if (token === html.TokenType.StartTagSelfClose || token === html.TokenType.StartTagClose) {
							if (current) {
								for (const requiredProp of current.unburnedRequiredProps) {
									result.push({
										label: `${requiredProp}!`,
										paddingLeft: true,
										position: document.positionAt(current.labelOffset),
										kind: 2 satisfies typeof InlayHintKind.Parameter,
										textEdits: [{
											range: {
												start: document.positionAt(current.labelOffset),
												end: document.positionAt(current.labelOffset),
											},
											newText: ` :${
												casing.attr === AttrNameCasing.Kebab ? hyphenateAttr(requiredProp) : requiredProp
											}=`,
										}],
									});
								}
								current = undefined;
							}
						}
					}

					return result;
				},
			};
		},
	};

	function getScanner(context: LanguageServiceContext, document: TextDocument): html.Scanner | undefined {
		if (document.languageId === 'html') {
			return context.inject('html/languageService').createScanner(document.getText());
		} else {
			const pugDocument = context.inject('pug/pugDocument', document);
			if (pugDocument) {
				return context.inject('pug/languageService').createScanner(pugDocument);
			}
		}
	}

	function isSupportedDocument(document: TextDocument) {
		return document.languageId === 'jade' || document.languageId === 'html';
	}
}
