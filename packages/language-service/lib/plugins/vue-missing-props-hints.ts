import type { LanguageServiceContext } from '@volar/language-service';
import { VueVirtualCode, hyphenateAttr, hyphenateTag } from '@vue/language-core';
import * as html from 'vscode-html-languageservice';
import type * as vscode from 'vscode-languageserver-protocol';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import { URI } from 'vscode-uri';
import { getNameCasing } from '../ideFeatures/nameCasing';
import { AttrNameCasing, LanguageServicePlugin } from '../types';

export function create(
	getTsPluginClient?: (context: LanguageServiceContext) => import('@vue/typescript-plugin/lib/requests').Requests | undefined
): LanguageServicePlugin {
	
	return {
		name: `vue-missing-props-hints`,
		capabilities: {
			inlayHintProvider: {},
		},
		create(context) {
			const tsPluginClient = getTsPluginClient?.(context);
			let intrinsicElementNames: Set<string>;

			return {

				async provideInlayHints(document) {

					if (!isSupportedDocument(document)) {
						return;
					}

					if (!context.project.vue) {
						return;
					}
					const vueCompilerOptions = context.project.vue.compilerOptions;

					const enabled = await context.env.getConfiguration?.<boolean>('vue.inlayHints.missingProps') ?? false;
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

					const result: vscode.InlayHint[] = [];
					const casing = await getNameCasing(context, decoded[0]);
					const components = await tsPluginClient?.getComponentNames(root.fileName) ?? [];
					const componentProps: Record<string, string[]> = {};

					let token: html.TokenType;
					let current: {
						unburnedRequiredProps: string[];
						labelOffset: number;
						insertOffset: number;
					} | undefined;

					while ((token = scanner.scan()) !== html.TokenType.EOS) {
						if (token === html.TokenType.StartTag) {
							const tagName = scanner.getTokenText();
							intrinsicElementNames ??= new Set(
								await tsPluginClient?.getElementNames(root.fileName) ?? []
							);

							const checkTag = tagName.includes('.')
								? tagName
								: components.find(component => component === tagName || hyphenateTag(component) === tagName);
							if (checkTag) {
								componentProps[checkTag] ??= (await tsPluginClient?.getComponentProps(root.fileName, checkTag) ?? [])
									.filter(prop => prop.required)
									.map(prop => prop.name);
								current = {
									unburnedRequiredProps: [...componentProps[checkTag]],
									labelOffset: scanner.getTokenOffset() + scanner.getTokenLength(),
									insertOffset: scanner.getTokenOffset() + scanner.getTokenLength(),
								};
							}
						}
						else if (token === html.TokenType.AttributeName) {
							if (current) {
								let attrText = scanner.getTokenText();

								if (attrText === 'v-bind') {
									current.unburnedRequiredProps = [];
								}
								else {
									// remove modifiers
									if (attrText.includes('.')) {
										attrText = attrText.split('.')[0];
									}
									// normalize
									if (attrText.startsWith('v-bind:')) {
										attrText = attrText.slice('v-bind:'.length);
									}
									else if (attrText.startsWith(':')) {
										attrText = attrText.slice(':'.length);
									}
									else if (attrText.startsWith('v-model:')) {
										attrText = attrText.slice('v-model:'.length);
									}
									else if (attrText === 'v-model') {
										attrText = vueCompilerOptions.target >= 3 ? 'modelValue' : 'value'; // TODO: support for experimentalModelPropName?
									}
									else if (attrText.startsWith('v-on:')) {
										attrText = 'on-' + hyphenateAttr(attrText.slice('v-on:'.length));
									}
									else if (attrText.startsWith('@')) {
										attrText = 'on-' + hyphenateAttr(attrText.slice('@'.length));
									}

									current.unburnedRequiredProps = current.unburnedRequiredProps.filter(propName => {
										return attrText !== propName
											&& attrText !== hyphenateAttr(propName);
									});
								}
							}
						}
						else if (token === html.TokenType.StartTagSelfClose || token === html.TokenType.StartTagClose) {
							if (current) {
								for (const requiredProp of current.unburnedRequiredProps) {
									result.push({
										label: `${requiredProp}!`,
										paddingLeft: true,
										position: document.positionAt(current.labelOffset),
										kind: 2 satisfies typeof vscode.InlayHintKind.Parameter,
										textEdits: [{
											range: {
												start: document.positionAt(current.insertOffset),
												end: document.positionAt(current.insertOffset),
											},
											newText: ` :${casing.attr === AttrNameCasing.Kebab ? hyphenateAttr(requiredProp) : requiredProp}=`,
										}],
									});
								}
								current = undefined;
							}
						}
						if (token === html.TokenType.AttributeName || token === html.TokenType.AttributeValue) {
							if (current) {
								current.insertOffset = scanner.getTokenOffset() + scanner.getTokenLength();
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
		}
		else {
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
