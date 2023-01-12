import type { LanguageService, LanguageServicePluginInstance, LanguageServiceRuntimeContext } from '@volar/language-service';
import type { VueLanguageServiceHost } from '@volar/vue-language-core';

export enum TagNameCasing {
	Kebab,
	Pascal,
}

export enum AttrNameCasing {
	Kebab,
	Camel,
}

export type VueLanguageServicePlugin<T = {}> = ((context: LanguageServiceRuntimeContext<VueLanguageServiceHost>, service: LanguageService) => LanguageServicePluginInstance & T);

// only export types of depend packages
export * from '@volar/vue-language-core/out/types';
