import { FileCapabilities, FileRangeCapabilities } from '@volar/language-core';
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

		resolveEmbeddedFile(_fileName, sfc, embeddedFile) {
			const match = embeddedFile.fileName.match(/^(.*)\.template\.([^.]+)$/);
			if (match && sfc.template) {
				embeddedFile.capabilities = {
					...FileCapabilities.full,
					documentFormatting: {
						initialIndentBracket: presetInitialIndentBrackets[sfc.template.lang],
					},
				};
				embeddedFile.content.push([
					sfc.template.content,
					sfc.template.name,
					0,
					FileRangeCapabilities.full,
				]);
			}
		},
	};
};
export = plugin;
