import type { RawVueCompilerOptions } from '../types';

const syntaxRE = /^\s*@(?<key>.+?)\s+(?<value>.+?)\s*$/m;

export function parseVueCompilerOptions(comments: string[]): RawVueCompilerOptions | undefined {
	const entries = comments
		.map(text => {
			try {
				const match = text.match(syntaxRE);
				if (match) {
					const { key, value } = match.groups ?? {};
					return [key, JSON.parse(value!)] as const;
				}
			}
			catch {}
		})
		.filter(item => !!item);

	if (entries.length) {
		return Object.fromEntries(entries);
	}
}
