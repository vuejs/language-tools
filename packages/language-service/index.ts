export * from '@volar/language-service';
export * from '@vue/language-core';
export * from './lib/ideFeatures/nameCasing';
export * from './lib/types';

import type { ServiceContext, ServiceEnvironment, ServicePlugin } from '@volar/language-service';
import type { VueCompilerOptions } from './lib/types';

import { create as createEmmetServicePlugin } from 'volar-service-emmet';
import { create as createJsonServicePlugin } from 'volar-service-json';
import { create as createPugFormatServicePlugin } from 'volar-service-pug-beautify';
import { create as createTypeScriptServicePlugins } from 'volar-service-typescript';
import { create as createTypeScriptTwoslashQueriesServicePlugin } from 'volar-service-typescript-twoslash-queries';
import { create as createTypeScriptDocCommentTemplateServicePlugin } from 'volar-service-typescript/lib/plugins/docCommentTemplate';
import { create as createTypeScriptSyntacticServicePlugin } from 'volar-service-typescript/lib/plugins/syntactic';
import { create as createCssServicePlugin } from './lib/plugins/css';
import { create as createVueAutoDotValueServicePlugin } from './lib/plugins/vue-autoinsert-dotvalue';
import { create as createVueAutoWrapParenthesesServicePlugin } from './lib/plugins/vue-autoinsert-parentheses';
import { create as createVueAutoAddSpaceServicePlugin } from './lib/plugins/vue-autoinsert-space';
import { create as createVueReferencesCodeLensServicePlugin } from './lib/plugins/vue-codelens-references';
import { create as createVueDirectiveCommentsServicePlugin } from './lib/plugins/vue-directive-comments';
import { create as createVueDocumentDropServicePlugin } from './lib/plugins/vue-document-drop';
import { create as createVueExtractFileServicePlugin } from './lib/plugins/vue-extract-file';
import { create as createVueSfcServicePlugin } from './lib/plugins/vue-sfc';
import { create as createVueTemplateServicePlugin } from './lib/plugins/vue-template';
import { create as createVueToggleVBindServicePlugin } from './lib/plugins/vue-toggle-v-bind-codeaction';
import { create as createVueTwoslashQueriesServicePlugin } from './lib/plugins/vue-twoslash-queries';
import { create as createVueVisualizeHiddenCallbackParamServicePlugin } from './lib/plugins/vue-visualize-hidden-callback-param';

import { decorateLanguageServiceForVue } from '@vue/typescript-plugin/lib/common';
import { collectExtractProps } from '@vue/typescript-plugin/lib/requests/collectExtractProps';
import { getComponentEvents, getComponentNames, getComponentProps, getElementAttrs, getTemplateContextProps } from '@vue/typescript-plugin/lib/requests/componentInfos';
import { getPropertiesAtLocation } from '@vue/typescript-plugin/lib/requests/getPropertiesAtLocation';
import { getQuickInfoAtPosition } from '@vue/typescript-plugin/lib/requests/getQuickInfoAtPosition';

export function createVueServicePlugins(
	ts: typeof import('typescript'),
	getVueOptions: (env: ServiceEnvironment) => VueCompilerOptions,
	getTsPluginClient?: (context: ServiceContext) => typeof import('@vue/typescript-plugin/lib/client') | undefined,
): ServicePlugin[] {
	const plugins: ServicePlugin[] = [];
	const hybridMode = !!getTsPluginClient;
	if (!hybridMode) {
		plugins.push(...createTypeScriptServicePlugins(ts));
		for (let i = 0; i < plugins.length; i++) {
			const plugin = plugins[i];
			if (plugin.name === 'typescript-semantic') {
				plugins[i] = {
					...plugin,
					create(context) {
						const created = plugin.create(context);
						if (!context.language.typescript) {
							return created;
						}
						const languageService = (created.provide as import('volar-service-typescript').Provide)['typescript/languageService']();
						const vueOptions = getVueOptions(context.env);
						decorateLanguageServiceForVue(context.language.files, languageService, vueOptions, ts, false);
						return created;
					},
				};
				break;
			}
		}
		getTsPluginClient = context => {
			if (!context.language.typescript) {
				return;
			}
			const requestContext = {
				typescript: ts,
				files: context.language.files,
				languageService: context.inject<(import('volar-service-typescript').Provide), 'typescript/languageService'>('typescript/languageService'),
				vueOptions: getVueOptions(context.env),
				isTsPlugin: false,
				getFileId: context.env.typescript!.fileNameToUri,
			};
			return {
				async collectExtractProps(...args) {
					return await collectExtractProps.apply(requestContext, args);
				},
				async getPropertiesAtLocation(...args) {
					return await getPropertiesAtLocation.apply(requestContext, args);
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
	else {
		plugins.push(
			createTypeScriptSyntacticServicePlugin(ts),
			createTypeScriptDocCommentTemplateServicePlugin(ts),
		);
	}
	plugins.push(
		createTypeScriptTwoslashQueriesServicePlugin(ts),
		createCssServicePlugin(),
		createPugFormatServicePlugin(),
		createJsonServicePlugin(),
		createVueTemplateServicePlugin('html', ts, getVueOptions, getTsPluginClient),
		createVueTemplateServicePlugin('pug', ts, getVueOptions, getTsPluginClient),
		createVueSfcServicePlugin(),
		createVueTwoslashQueriesServicePlugin(ts, getTsPluginClient),
		createVueReferencesCodeLensServicePlugin(),
		createVueDocumentDropServicePlugin(ts),
		createVueAutoDotValueServicePlugin(ts, getTsPluginClient),
		createVueAutoWrapParenthesesServicePlugin(ts),
		createVueAutoAddSpaceServicePlugin(),
		createVueVisualizeHiddenCallbackParamServicePlugin(),
		createVueDirectiveCommentsServicePlugin(),
		createVueExtractFileServicePlugin(ts, getTsPluginClient),
		createVueToggleVBindServicePlugin(ts),
		createEmmetServicePlugin(),
	);
	return plugins;
}
