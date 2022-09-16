import { ServerInitializationOptions } from "@volar/language-server";

export type VueServerInitializationOptions = ServerInitializationOptions & {
	petiteVue?: {
		processHtmlFile: boolean,
	},
	vitePress?: {
		processMdFile: boolean,
	},
};
