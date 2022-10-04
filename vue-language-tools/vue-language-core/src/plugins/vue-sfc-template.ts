import { VueLanguagePlugin } from '../types';

const presetInitialIndentBrackets: Record<string, [string, string] | undefined> = {
	html: ['<template>', '</template>'],
};

const plugin: VueLanguagePlugin = () => {

	return {

		version: 1,

		getEmbeddedFileNames(fileName, sfc) {
			if (sfc.template) {
				return [fileName + '.template.' + sfc.template.lang];
			}
			return [];
		},

		resolveEmbeddedFile(fileName, sfc, embeddedFile) {
			const match = embeddedFile.fileName.match(/^(.*)\.template\.([^.]+)$/);
			if (match && sfc.template) {
				embeddedFile.capabilities = {
					diagnostic: true,
					foldingRange: true,
					documentFormatting: {
						initialIndentBracket: presetInitialIndentBrackets[sfc.template.lang],
					},
					documentSymbol: true,
					codeAction: true,
					inlayHint: true,
				};
				embeddedFile.content.push([
					sfc.template.content,
					sfc.template.name,
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
