import { VueLanguagePlugin } from '../sourceFile';

const presetInitialIndentBrackets: Record<string, [string, string] | undefined> = {
	json: ['{', '}'],
	jsonc: ['{', '}'],
	html: ['<template>', '</template>'],
	markdown: ['<template>', '</template>'],
};

const plugin: VueLanguagePlugin = () => {

	return {

		getEmbeddedFileNames(fileName, sfc) {
			const names: string[] = [];
			for (let i = 0; i < sfc.customBlocks.length; i++) {
				const customBlock = sfc.customBlocks[i];
				names.push(fileName + '.customBlock_' + customBlock.type + '_' + i + '.' + customBlock.lang);
			}
			return names;
		},

		resolveEmbeddedFile(fileName, sfc, embeddedFile) {
			const match = embeddedFile.fileName.match(/^(.*)\.customBlock_([^_]+)_(\d+)\.([^.]+)$/);
			if (match) {
				const index = parseInt(match[3]);
				const customBlock = sfc.customBlocks[index];

				embeddedFile.capabilities = {
					diagnostics: true,
					foldingRanges: true,
					formatting: {
						initialIndentBracket: presetInitialIndentBrackets[customBlock.lang],
					},
					documentSymbol: true,
					codeActions: true,
					inlayHints: true,
				};
				embeddedFile.isTsHostFile = false;
				embeddedFile.codeGen.addCode2(
					customBlock.content,
					0,
					{
						vueTag: customBlock.tag,
						vueTagIndex: index,
						capabilities: {
							basic: true,
							references: true,
							definitions: true,
							diagnostic: true,
							rename: true,
							completion: true,
							semanticTokens: true,
						},
					},
				);
			}
		},
	};
}
export = plugin;
