import type { Code, Sfc } from '../../types';
import { endOfLine } from '../utils';
import { codeFeatures } from './index';

export function* generateSrc(
	script: NonNullable<Sfc['script']>,
	src: string
): Generator<Code> {
	if (src.endsWith('.d.ts')) {
		src = src.slice(0, -'.d.ts'.length);
	}
	else if (src.endsWith('.ts')) {
		src = src.slice(0, -'.ts'.length);
	}
	else if (src.endsWith('.tsx')) {
		src = src.slice(0, -'.tsx'.length) + '.jsx';
	}

	if (!src.endsWith('.js') && !src.endsWith('.jsx')) {
		src = src + '.js';
	}

	yield `export * from `;
	yield [
		`'${src}'`,
		'script',
		script.srcOffset - 1,
		{
			...codeFeatures.all,
			navigation: src === script.src
				? true
				: {
					shouldRename: () => false,
					resolveRenameEditText(newName) {
						if (newName.endsWith('.jsx') || newName.endsWith('.js')) {
							newName = newName.split('.').slice(0, -1).join('.');
						}
						if (script?.src?.endsWith('.d.ts')) {
							newName = newName + '.d.ts';
						}
						else if (script?.src?.endsWith('.ts')) {
							newName = newName + '.ts';
						}
						else if (script?.src?.endsWith('.tsx')) {
							newName = newName + '.tsx';
						}
						return newName;
					},
				},
		},
	];
	yield endOfLine;
	yield `export { default } from '${src}'${endOfLine}`;
}
