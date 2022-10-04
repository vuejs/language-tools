import { VueLanguagePlugin } from '../types';

const presetInitialIndentBrackets: Record<string, [string, string] | undefined> = {
	json: ['{', '}'],
	jsonc: ['{', '}'],
	html: ['<template>', '</template>'],
	markdown: ['<template>', '</template>'],
};

const plugin: VueLanguagePlugin = () => {

	return {

		version: 1,

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
					diagnostic: true,
					foldingRange: true,
					documentFormatting: {
						initialIndentBracket: presetInitialIndentBrackets[customBlock.lang],
					},
					documentSymbol: true,
					codeAction: true,
					inlayHint: true,
				};
				embeddedFile.content.push([
					customBlock.content,
					customBlock.name,
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
