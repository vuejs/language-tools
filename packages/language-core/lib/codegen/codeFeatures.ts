import type { VueCodeInformation } from '../types';

export const codeFeatures = defineCodeFeatures({
	full: {
		verification: true,
		completion: true,
		semantic: true,
		navigation: true,
		structure: true,
		format: true,
	},
	/** @internal */
	all: {
		verification: true,
		completion: true,
		semantic: true,
		navigation: true,
	},
	/** @internal */
	importCompletionOnly: {
		__importCompletion: true,
	},
	/** @internal */
	verification: {
		verification: true,
	},
	/** @internal */
	completion: {
		completion: true,
	},
	/** @internal */
	withoutCompletion: {
		verification: true,
		semantic: true,
		navigation: true,
	},
	/** @internal */
	navigation: {
		navigation: true,
	},
	/** @internal */
	navigationWithoutRename: {
		navigation: { shouldRename: () => false },
	},
	/** @internal */
	navigationAndCompletion: {
		navigation: true,
		completion: true,
	},
	/** @internal */
	navigationAndVerification: {
		navigation: true,
		verification: true,
	},
	/** @internal */
	withoutNavigation: {
		verification: true,
		completion: true,
		semantic: true,
	},
	/** @internal */
	semanticWithoutHighlight: {
		semantic: { shouldHighlight: () => false },
	},
	/** @internal */
	withoutHighlight: {
		semantic: { shouldHighlight: () => false },
		verification: true,
		navigation: true,
		completion: true,
	},
	/** @internal */
	withoutHighlightAndCompletion: {
		semantic: { shouldHighlight: () => false },
		verification: true,
		navigation: true,
	},
	/** @internal */
	withoutSemantic: {
		verification: true,
		navigation: true,
		completion: true,
	},
	/** @internal */
	structure: {
		structure: true,
	},
	/** @internal */
	structureAndFormat: {
		structure: true,
		format: true,
	},
	/** @internal */
	format: {
		format: true,
	},
});

/** @deprecated use `codeFeatures.full` instead */
export const allCodeFeatures = codeFeatures.full;

function defineCodeFeatures<T extends Record<string, VueCodeInformation>>(features: T) {
	return features as {
		[K in keyof T]: VueCodeInformation;
	};
}
