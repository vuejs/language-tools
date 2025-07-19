import type { VueCodeInformation } from '../types';

const raw = {
	all: {
		verification: true,
		completion: true,
		semantic: true,
		navigation: true,
	},
	verification: {
		verification: true,
	},
	completion: {
		completion: true,
	},
	additionalCompletion: {
		completion: { isAdditional: true },
	},
	withoutCompletion: {
		verification: true,
		semantic: true,
		navigation: true,
	},
	navigation: {
		navigation: true,
	},
	navigationWithoutRename: {
		navigation: { shouldRename: () => false },
	},
	navigationAndCompletion: {
		navigation: true,
		completion: true,
	},
	navigationAndAdditionalCompletion: {
		navigation: true,
		completion: { isAdditional: true },
	},
	navigationAndVerification: {
		navigation: true,
		verification: true,
	},
	withoutNavigation: {
		verification: true,
		completion: true,
		semantic: true,
	},
	semanticWithoutHighlight: {
		semantic: { shouldHighlight: () => false },
	},
	withoutHighlight: {
		semantic: { shouldHighlight: () => false },
		verification: true,
		navigation: true,
		completion: true,
	},
	withoutHighlightAndNavigation: {
		semantic: { shouldHighlight: () => false },
		verification: true,
		completion: true,
	},
	withoutHighlightAndCompletion: {
		semantic: { shouldHighlight: () => false },
		verification: true,
		navigation: true,
	},
	withoutHighlightAndCompletionAndNavigation: {
		semantic: { shouldHighlight: () => false },
		verification: true,
	},
	withoutSemantic: {
		verification: true,
		navigation: true,
		completion: true,
	},
	doNotReportTs2339: {
		verification: {
			// https://typescript.tv/errors/#ts2339
			shouldReport: (_source, code) => String(code) !== '2339',
		},
	},
	doNotReportTs2353AndTs2561: {
		verification: {
			// https://typescript.tv/errors/#ts2353
			// https://typescript.tv/errors/#ts2561
			shouldReport: (_source, code) => String(code) !== '2353' && String(code) !== '2561',
		},
	},
	doNotReportTs6133: {
		verification: {
			// https://typescript.tv/errors/#ts6133
			shouldReport: (_source, code) => String(code) !== '6133',
		},
	},
} satisfies Record<string, VueCodeInformation>;

export const codeFeatures = raw as {
	[K in keyof typeof raw]: VueCodeInformation;
};
