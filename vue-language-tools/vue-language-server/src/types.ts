import { LanguageServerInitializationOptions } from "@volar/language-server";

export type VueServerInitializationOptions = LanguageServerInitializationOptions & {
	petiteVue?: {
		processHtmlFile: boolean,
	},
	vitePress?: {
		processMdFile: boolean,
	},
	additionalExtensions?: string[],
};
