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
	/** @internal */
	doNotReportTs2339AndTs2551: {
		verification: {
			// https://typescript.tv/errors/#ts2339
			// https://typescript.tv/errors/#ts2551
			shouldReport: (_source, code) => String(code) !== '2339' && String(code) !== '2551',
		},
	},
	/** @internal */
	doNotReportTs2353AndTs2561: {
		verification: {
			// https://typescript.tv/errors/#ts2353
			// https://typescript.tv/errors/#ts2561
			shouldReport: (_source, code) => String(code) !== '2353' && String(code) !== '2561',
		},
	},
	/** @internal */
	doNotReportTs6133: {
		verification: {
			// https://typescript.tv/errors/#ts6133
			shouldReport: (_source, code) => String(code) !== '6133',
		},
	},
});

/** @deprecated use `codeFeatures.full` instead */
export const allCodeFeatures = codeFeatures.full;

function defineCodeFeatures<T extends Record<string, VueCodeInformation>>(features: T) {
	return features as {
		[K in keyof T]: VueCodeInformation;
	};
}
