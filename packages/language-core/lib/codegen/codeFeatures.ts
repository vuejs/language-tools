import type { VueCodeInformation } from '../types';

export const codeFeatures = {
	all: {
		verification: true,
		completion: true,
		semantic: true,
		navigation: true,
	} as VueCodeInformation,
	none: {} as VueCodeInformation,

	verification: {
		verification: true,
	} as VueCodeInformation,

	completion: {
		completion: true,
	} as VueCodeInformation,
	additionalCompletion: {
		completion: { isAdditional: true },
	} as VueCodeInformation,

	withoutCompletion: {
		verification: true,
		semantic: true,
		navigation: true,
	} as VueCodeInformation,

	navigation: {
		navigation: true,
	} as VueCodeInformation,
	navigationWithoutRename: {
		navigation: { shouldRename: () => false },
	} as VueCodeInformation,
	navigationAndCompletion: {
		navigation: true,
		completion: true,
	} as VueCodeInformation,
	navigationAndAdditionalCompletion: {
		navigation: true,
		completion: { isAdditional: true },
	} as VueCodeInformation,

	withoutNavigation: {
		verification: true,
		completion: true,
		semantic: true,
	} as VueCodeInformation,

	withoutHighlight: {
		semantic: { shouldHighlight: () => false },
		verification: true,
		navigation: true,
		completion: true
	} as VueCodeInformation,
	withoutHighlightAndCompletion: {
		semantic: { shouldHighlight: () => false },
		verification: true,
		navigation: true,
	} as VueCodeInformation,
	withoutHighlightAndNavigation: {
		semantic: { shouldHighlight: () => false },
		verification: true,
		completion: true,
	} as VueCodeInformation,
	withoutHighlightAndCompletionAndNavigation: {
		semantic: { shouldHighlight: () => false },
		verification: true,
	} as VueCodeInformation,
};
