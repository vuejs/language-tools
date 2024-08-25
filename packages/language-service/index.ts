/// <reference types="@volar/typescript" />

export * from '@volar/language-service';
export * from '@vue/language-core';
export * from './lib/ideFeatures/nameCasing';
export * from './lib/types';

import type { LanguageServiceContext, LanguageServicePlugin } from '@volar/language-service';
import { AttrNameCasing, commands, TagNameCasing } from './lib/types';

import { create as createEmmetPlugin } from 'volar-service-emmet';
import { create as createJsonPlugin } from 'volar-service-json';
import { create as createPugFormatPlugin } from 'volar-service-pug-beautify';
import { create as createTypeScriptPlugins } from 'volar-service-typescript';
import { create as createTypeScriptTwoslashQueriesPlugin } from 'volar-service-typescript-twoslash-queries';
import { create as createTypeScriptDocCommentTemplatePlugin } from 'volar-service-typescript/lib/plugins/docCommentTemplate';
import { create as createTypeScriptSyntacticPlugin } from 'volar-service-typescript/lib/plugins/syntactic';
import { create as createCssPlugin } from './lib/plugins/css';
import { create as createVueAutoDotValuePlugin } from './lib/plugins/vue-autoinsert-dotvalue';
import { create as createVueAutoAddSpacePlugin } from './lib/plugins/vue-autoinsert-space';
import { create as createVueDirectiveCommentsPlugin } from './lib/plugins/vue-directive-comments';
import { create as createVueDocumentDropPlugin } from './lib/plugins/vue-document-drop';
import { create as createVueDocumentLinksPlugin } from './lib/plugins/vue-document-links';
import { create as createVueExtractFilePlugin } from './lib/plugins/vue-extract-file';
import { create as createVueSfcPlugin } from './lib/plugins/vue-sfc';
import { create as createVueTemplatePlugin } from './lib/plugins/vue-template';
import { create as createVueTwoslashQueriesPlugin } from './lib/plugins/vue-twoslash-queries';
import { create as createVueInlayHintsPlugin } from './lib/plugins/vue-inlayhints';

import { parse, VueCompilerOptions } from '@vue/language-core';
import { proxyLanguageServiceForVue } from '@vue/typescript-plugin/lib/common';
import { collectExtractProps } from '@vue/typescript-plugin/lib/requests/collectExtractProps';
import { getComponentEvents, getComponentNames, getComponentProps, getElementAttrs, getTemplateContextProps } from '@vue/typescript-plugin/lib/requests/componentInfos';
import { getImportPathForFile } from '@vue/typescript-plugin/lib/requests/getImportPathForFile';
import { getPropertiesAtLocation } from '@vue/typescript-plugin/lib/requests/getPropertiesAtLocation';
import type { RequestContext } from '@vue/typescript-plugin/lib/requests/types';
import { URI } from 'vscode-uri';
import { convertAttrName, convertTagName, detect } from './lib/ideFeatures/nameCasing';

declare module '@volar/language-service' {
	export interface ProjectContext {
		vue?: {
			compilerOptions: VueCompilerOptions;
		};
	}
}

export function getFullLanguageServicePlugins(
	ts: typeof import('typescript'),
	{ disableAutoImportCache }: { disableAutoImportCache?: boolean; } = {}
): LanguageServicePlugin[] {
	const plugins: LanguageServicePlugin[] = [
		...createTypeScriptPlugins(ts, { disableAutoImportCache }),
		...getCommonLanguageServicePlugins(
			ts,
			getTsPluginClientForLSP
		)
	];
	for (let i = 0; i < plugins.length; i++) {
		const plugin = plugins[i];
		if (plugin.name === 'typescript-semantic') {
			plugins[i] = {
				...plugin,
				create(context) {
					const created = plugin.create(context);
					if (!context.project.typescript) {
						return created;
					}
					const languageService = (created.provide as import('volar-service-typescript').Provide)['typescript/languageService']();
					if (context.project.vue) {
						const proxy = proxyLanguageServiceForVue(
							ts,
							context.language,
							languageService,
							context.project.vue.compilerOptions,
							s => context.project.typescript?.uriConverter.asUri(s)
						);
						languageService.getCompletionsAtPosition = proxy.getCompletionsAtPosition;
						languageService.getCompletionEntryDetails = proxy.getCompletionEntryDetails;
						languageService.getCodeFixesAtPosition = proxy.getCodeFixesAtPosition;
						languageService.getQuickInfoAtPosition = proxy.getQuickInfoAtPosition;
					}
					return created;
				},
			};
			break;
		}
	}
	return plugins;

	function getTsPluginClientForLSP(context: LanguageServiceContext): typeof import('@vue/typescript-plugin/lib/client') | undefined {
		if (!context.project.typescript) {
			return;
		}
		const languageService = context.inject<(import('volar-service-typescript').Provide), 'typescript/languageService'>('typescript/languageService');
		if (!languageService) {
			return;
		}
		const requestContext: RequestContext<URI> = {
			typescript: ts,
			language: context.language,
			languageService,
			languageServiceHost: context.project.typescript.languageServiceHost,
			isTsPlugin: false,
			getFileId: s => context.project.typescript!.uriConverter.asUri(s),
		};
		return {
			async collectExtractProps(...args) {
				return await collectExtractProps.apply(requestContext, args);
			},
			async getPropertiesAtLocation(...args) {
				return await getPropertiesAtLocation.apply(requestContext, args);
			},
			async getImportPathForFile(...args) {
				return await getImportPathForFile.apply(requestContext, args);
			},
			async getComponentEvents(...args) {
				return await getComponentEvents.apply(requestContext, args);
			},
			async getComponentNames(...args) {
				return await getComponentNames.apply(requestContext, args);
			},
			async getComponentProps(...args) {
				return await getComponentProps.apply(requestContext, args);
			},
			async getElementAttrs(...args) {
				return await getElementAttrs.apply(requestContext, args);
			},
			async getTemplateContextProps(...args) {
				return await getTemplateContextProps.apply(requestContext, args);
			},
			async getQuickInfoAtPosition(fileName, position) {
				const languageService = context.getLanguageService();
				const uri = context.project.typescript!.uriConverter.asUri(fileName);
				const sourceScript = context.language.scripts.get(uri);
				if (!sourceScript) {
					return;
				}
				const document = context.documents.get(uri, sourceScript.languageId, sourceScript.snapshot);
				const hover = await languageService.getHover(uri, document.positionAt(position));
				let text = '';
				if (typeof hover?.contents === 'string') {
					text = hover.contents;
				}
				else if (Array.isArray(hover?.contents)) {
					text = hover.contents.map(c => typeof c === 'string' ? c : c.value).join('\n');
				}
				else if (hover) {
					text = hover.contents.value;
				}
				text = text.replace(/```typescript/g, '');
				text = text.replace(/```/g, '');
				text = text.replace(/---/g, '');
				text = text.trim();
				while (true) {
					const newText = text.replace(/\n\n/g, '\n');
					if (newText === text) {
						break;
					}
					text = newText;
				}
				text = text.replace(/\n/g, ' | ');
				return text;
			},
		};
	}
}

export function getHybridModeLanguageServicePlugins(
	ts: typeof import('typescript'),
	getTsPluginClient: typeof import("@vue/typescript-plugin/lib/client")
): LanguageServicePlugin[] {
	const plugins = [
		createTypeScriptSyntacticPlugin(ts),
		createTypeScriptDocCommentTemplatePlugin(ts),
		...getCommonLanguageServicePlugins(ts, () => getTsPluginClient)
	];
	for (const plugin of plugins) {
		// avoid affecting TS plugin
		delete plugin.capabilities.semanticTokensProvider;
	}
	return plugins;
}

function getCommonLanguageServicePlugins(
	ts: typeof import('typescript'),
	getTsPluginClient: (context: LanguageServiceContext) => typeof import('@vue/typescript-plugin/lib/client') | undefined
): LanguageServicePlugin[] {
	return [
		createTypeScriptTwoslashQueriesPlugin(ts),
		createCssPlugin(),
		createPugFormatPlugin(),
		createJsonPlugin(),
		createVueTemplatePlugin('html', ts, getTsPluginClient),
		createVueTemplatePlugin('pug', ts, getTsPluginClient),
		createVueSfcPlugin(),
		createVueTwoslashQueriesPlugin(getTsPluginClient),
		createVueDocumentLinksPlugin(),
		createVueDocumentDropPlugin(ts, getTsPluginClient),
		createVueAutoDotValuePlugin(ts, getTsPluginClient),
		createVueAutoAddSpacePlugin(),
		createVueInlayHintsPlugin(ts),
		createVueDirectiveCommentsPlugin(),
		createVueExtractFilePlugin(ts, getTsPluginClient),
		createEmmetPlugin({
			mappedLanguages: {
				'vue-root-tags': 'html',
				'postcss': 'scss',
			},
		}),
		{
			name: 'vue-parse-sfc',
			capabilities: {
				executeCommandProvider: {
					commands: [commands.parseSfc],
				},
			},
			create() {
				return {
					executeCommand(_command, [source]) {
						return parse(source);
					},
				};
			},
		},
		{
			name: 'vue-name-casing',
			capabilities: {
				executeCommandProvider: {
					commands: [
						commands.detectNameCasing,
						commands.convertTagsToKebabCase,
						commands.convertTagsToPascalCase,
						commands.convertPropsToKebabCase,
						commands.convertPropsToCamelCase,
					],
				}
			},
			create(context) {
				return {
					executeCommand(command, [uri]) {
						if (command === commands.detectNameCasing) {
							return detect(context, URI.parse(uri));
						}
						else if (command === commands.convertTagsToKebabCase) {
							return convertTagName(context, URI.parse(uri), TagNameCasing.Kebab, getTsPluginClient(context));
						}
						else if (command === commands.convertTagsToPascalCase) {
							return convertTagName(context, URI.parse(uri), TagNameCasing.Pascal, getTsPluginClient(context));
						}
						else if (command === commands.convertPropsToKebabCase) {
							return convertAttrName(context, URI.parse(uri), AttrNameCasing.Kebab, getTsPluginClient(context));
						}
						else if (command === commands.convertPropsToCamelCase) {
							return convertAttrName(context, URI.parse(uri), AttrNameCasing.Camel, getTsPluginClient(context));
						}
					},
				};
			},
		}
	];
}
