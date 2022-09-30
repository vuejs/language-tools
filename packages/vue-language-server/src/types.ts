import { InitializationOptions } from "@volar/language-server";

export type VueServerInitializationOptions = InitializationOptions & {
	petiteVue?: {
		processHtmlFile: boolean,
	},
	vitePress?: {
		processMdFile: boolean,
	},
};
