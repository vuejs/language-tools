import { LanguageServerInitializationOptions } from "@volar/language-server";

export type VueServerInitializationOptions = LanguageServerInitializationOptions & {
	petiteVue?: {
		processHtmlFile: boolean;
	};
	vitePress?: {
		processMdFile: boolean;
	};
	json?: {
		customBlockSchemaUrls?: Record<string, string>;
	};
	/**
	 * @example ['vue1', 'vue2']
	 */
	additionalExtensions?: string[];
};
