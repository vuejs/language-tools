import { VueLanguagePlugin } from '../types';

const presetInitialIndentBrackets: Record<string, [string, string] | undefined> = {
	css: ['{', '}'],
	scss: ['{', '}'],
	less: ['{', '}'],
};

const plugin: VueLanguagePlugin = () => {

	return {

		version: 1,

		getEmbeddedFileNames(fileName, sfc) {
			const names: string[] = [];
			for (let i = 0; i < sfc.styles.length; i++) {
				const style = sfc.styles[i];
				names.push(fileName + '.style_' + i + '.' + style.lang);
			}
			return names;
		},

		resolveEmbeddedFile(_fileName, sfc, embeddedFile) {
			const match = embeddedFile.fileName.match(/^(.*)\.style_(\d+)\.([^.]+)$/);
			if (match) {
				const index = parseInt(match[2]);
				const style = sfc.styles[index];

				embeddedFile.capabilities = {
					diagnostic: true,
					foldingRange: true,
					documentFormatting: {
						initialIndentBracket: presetInitialIndentBrackets[style.lang],
					},
					documentSymbol: true,
					codeAction: true,
					inlayHint: true,
				};
				embeddedFile.content.push([
					style.content,
					style.name,
					0,
					{
						hover: true,
						references: true,
						definition: true,
						diagnostic: true,
						rename: true,
						completion: true,
						semanticTokens: true,
					},
				]);
			}
		},
	};
};
export = plugin;
