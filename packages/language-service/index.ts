export * from '@volar/language-service';
export * from '@vue/language-core';
export * from './lib/ideFeatures/nameCasing';
export * from './lib/types';

import type { LanguageServicePlugin, LanguageServiceContext, LanguageServiceEnvironment } from '@volar/language-service';
import type { VueCompilerOptions } from './lib/types';

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
import { create as createVueToggleVBindPlugin } from './lib/plugins/vue-toggle-v-bind-codeaction';
import { create as createVueTwoslashQueriesPlugin } from './lib/plugins/vue-twoslash-queries';
import { create as createVueVisualizeHiddenCallbackParamPlugin } from './lib/plugins/vue-visualize-hidden-callback-param';

import { decorateLanguageServiceForVue } from '@vue/typescript-plugin/lib/common';
import { collectExtractProps } from '@vue/typescript-plugin/lib/requests/collectExtractProps';
import { getComponentEvents, getComponentNames, getComponentProps, getElementAttrs, getTemplateContextProps } from '@vue/typescript-plugin/lib/requests/componentInfos';
import { getImportPathForFile } from '@vue/typescript-plugin/lib/requests/getImportPathForFile';
import { getPropertiesAtLocation } from '@vue/typescript-plugin/lib/requests/getPropertiesAtLocation';
import { getQuickInfoAtPosition } from '@vue/typescript-plugin/lib/requests/getQuickInfoAtPosition';
import type { RequestContext } from '@vue/typescript-plugin/lib/requests/types';
import { URI } from 'vscode-uri';

export function getVueLanguageServicePlugins(
	ts: typeof import('typescript'),
	getVueOptions: (env: LanguageServiceEnvironment) => VueCompilerOptions,
	getTsPluginClient = createDefaultGetTsPluginClient(ts),
	hybridMode = false,
): LanguageServicePlugin[] {
	const plugins: LanguageServicePlugin[] = [];
	if (!hybridMode) {
		plugins.push(...createTypeScriptPlugins(ts));
		for (let i = 0; i < plugins.length; i++) {
			const plugin = plugins[i];
			if (plugin.name === 'typescript-semantic') {
				plugins[i] = {
					...plugin,
					create(context, api) {
						const created = plugin.create(context, api);
						if (!context.language.typescript) {
							return created;
						}
						const languageService = (created.provide as import('volar-service-typescript').Provide)['typescript/languageService']();
						const vueOptions = getVueOptions(context.env);
						decorateLanguageServiceForVue<URI>(
							context.language,
							languageService,
							vueOptions,
							ts,
							false,
							fileName => context.language.typescript?.asScriptId(fileName) ?? URI.file(fileName),
						);
						return created;
					},
				};
				break;
			}
		}
	}
	else {
		plugins.push(
			createTypeScriptSyntacticPlugin(ts),
			createTypeScriptDocCommentTemplatePlugin(ts),
		);
	}
	plugins.push(
		createTypeScriptTwoslashQueriesPlugin(ts),
		createCssPlugin(),
		createPugFormatPlugin(),
		createJsonPlugin(),
		createVueTemplatePlugin('html', ts, getVueOptions, getTsPluginClient),
		createVueTemplatePlugin('pug', ts, getVueOptions, getTsPluginClient),
		createVueSfcPlugin(),
		createVueTwoslashQueriesPlugin(ts, getTsPluginClient),
		createVueDocumentLinksPlugin(),
		createVueDocumentDropPlugin(ts, getVueOptions, getTsPluginClient),
		createVueAutoDotValuePlugin(ts, getTsPluginClient),
		createVueAutoAddSpacePlugin(),
		createVueVisualizeHiddenCallbackParamPlugin(),
		createVueDirectiveCommentsPlugin(),
		createVueExtractFilePlugin(ts, getTsPluginClient),
		createVueToggleVBindPlugin(ts),
		createEmmetPlugin({
			mappedLanguages: {
				'vue': 'html',
				'postcss': 'scss',
			},
		}),
	);
	return plugins;
}

export function createDefaultGetTsPluginClient(ts: typeof import('typescript')): (context: LanguageServiceContext) => typeof import('@vue/typescript-plugin/lib/client') | undefined {
	return context => {
		if (!context.language.typescript) {
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
			languageServiceHost: context.language.typescript.languageServiceHost,
			isTsPlugin: false,
			getFileId: context.language.typescript.asScriptId,
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
			async getQuickInfoAtPosition(...args) {
				return await getQuickInfoAtPosition.apply(requestContext, args);
			},
		};
	};
}
