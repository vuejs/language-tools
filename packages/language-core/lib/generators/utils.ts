import type { Code, CodeAndStack, VueCodeInformation } from '../types';

export function withStack(code: Code): CodeAndStack {
	return [code, getStack()];
}

// TODO: import from muggle-string
export function getStack() {
	const stack = new Error().stack!;
	let source = stack.split('\n')[3].trim();
	if (source.endsWith(')')) {
		source = source.slice(source.lastIndexOf('(') + 1, -1);
	}
	else {
		source = source.slice(source.lastIndexOf(' ') + 1);
	}
	return source;
}

export function disableAllFeatures(override: Partial<VueCodeInformation>): VueCodeInformation {
	return {
		verification: false,
		completion: false,
		semantic: false,
		navigation: false,
		structure: false,
		format: false,
		...override,
	};
}

export function enableAllFeatures(override: Partial<VueCodeInformation>): VueCodeInformation {
	return {
		verification: true,
		completion: true,
		semantic: true,
		navigation: true,
		structure: true,
		format: true,
		...override,
	};
}

export function mergeFeatureSettings(base: VueCodeInformation, ...others: Partial<VueCodeInformation>[]): VueCodeInformation {
	const result: VueCodeInformation = { ...base };
	for (const info of others) {
		for (const key in info) {
			const value = info[key as keyof VueCodeInformation];
			if (value) {
				result[key as keyof VueCodeInformation] = value as any;
			}
		}
	}
	return result;
}
