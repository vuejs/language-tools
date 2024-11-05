import type { Sfc, VueCompilerOptions } from '../types';

const syntaxReg = /^\s*@(?<key>.+?)\s+(?<value>.+?)\s*$/m;

export function parseVueCompilerOptions(sfc: Sfc): Partial<VueCompilerOptions> | undefined {
	const entries = sfc.comments
		.map(text => {
			try {
				const match = text.match(syntaxReg);
				if (match) {
					const { key, value } = match.groups ?? {};
					return [key, JSON.parse(value)] as const;
				}
			}
			catch { };
		})
		.filter(item => !!item);

	if (entries.length) {
		return Object.fromEntries(entries);
	}
}
