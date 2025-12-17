import type {
	InlayHint,
	InlayHintKind,
	LanguageServiceContext,
	LanguageServicePlugin,
	TextDocument,
} from '@volar/language-service';
import { hyphenateAttr, hyphenateTag } from '@vue/language-core';
import * as html from 'vscode-html-languageservice';
import type { PropertyMeta } from '../../../component-meta';
import { AttrNameCasing, getAttrNameCasing } from '../nameCasing';
import { resolveEmbeddedCode } from '../utils';

export function create(
	{ getComponentNames, getElementNames, getComponentMeta }: import('@vue/typescript-plugin/lib/requests').Requests,
): LanguageServicePlugin {
	return {
		name: 'vue-missing-props-hints',
		capabilities: {
			inlayHintProvider: {},
		},
		create(context) {
			let intrinsicElementNames: Set<string> | undefined;

			return {
				async provideInlayHints(document, range, cancellationToken) {
					const info = resolveEmbeddedCode(context, document.uri);
					if (info?.code.id !== 'template') {
						return;
					}

					const enabled = await context.env.getConfiguration<boolean>?.('vue.inlayHints.missingProps') ?? false;
					if (!enabled) {
						return;
					}

					const scanner = getScanner(context, document);
					if (!scanner) {
						return;
					}

					const result: InlayHint[] = [];
					const attrNameCasing = await getAttrNameCasing(context, info.script.id);
					const components = await getComponentNames(info.root.fileName) ?? [];
					const componentProps = new Map<string, PropertyMeta[]>();

					intrinsicElementNames ??= new Set(
						await getElementNames(info.root.fileName) ?? [],
					);

					let token: html.TokenType;
					let current: {
						unburnedRequiredProps: PropertyMeta[];
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

							if (!componentProps.has(checkTag)) {
								if (cancellationToken.isCancellationRequested) {
									break;
								}
								componentProps.set(
									checkTag,
									((await getComponentMeta(info.root.fileName, checkTag))?.props ?? [])
										.filter(prop => prop.required),
								);
							}

							current = {
								unburnedRequiredProps: [...componentProps.get(checkTag)!],
								labelOffset: scanner.getTokenOffset() + scanner.getTokenLength(),
							};
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
										attrText = attrText.split('.')[0]!;
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
										attrText = 'modelValue'; // TODO: support for experimentalModelPropName?
									}
									else if (attrText.startsWith('v-on:')) {
										attrText = 'on-' + hyphenateAttr(attrText.slice('v-on:'.length));
									}
									else if (attrText.startsWith('@')) {
										attrText = 'on-' + hyphenateAttr(attrText.slice('@'.length));
									}

									current.unburnedRequiredProps = current.unburnedRequiredProps.filter(prop => {
										return attrText !== prop.name
											&& attrText !== hyphenateAttr(prop.name);
									});
								}
							}
						}
						else if (token === html.TokenType.StartTagSelfClose || token === html.TokenType.StartTagClose) {
							if (current) {
								for (const requiredProp of current.unburnedRequiredProps) {
									result.push({
										label: requiredProp.name,
										paddingLeft: true,
										position: document.positionAt(current.labelOffset),
										kind: 2 satisfies typeof InlayHintKind.Parameter,
										textEdits: [{
											range: {
												start: document.positionAt(current.labelOffset),
												end: document.positionAt(current.labelOffset),
											},
											newText: ` :${
												attrNameCasing === AttrNameCasing.Kebab ? hyphenateAttr(requiredProp.name) : requiredProp.name
											}="${requiredProp.default?.replace(/"/g, "'") ?? ''}"`,
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
		}
		else {
			const pugDocument = context.inject('pug/pugDocument', document);
			if (pugDocument) {
				return context.inject('pug/languageService').createScanner(pugDocument);
			}
		}
	}
}
