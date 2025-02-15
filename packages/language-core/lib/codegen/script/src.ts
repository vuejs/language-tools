import type { Code, SfcBlockAttr } from '../../types';
import { codeFeatures } from '../codeFeatures';
import { endOfLine, generateSfcBlockAttrValue } from '../utils';

export function* generateSrc(src: SfcBlockAttr): Generator<Code> {
	if (src === true) {
		return;
	}
	let { text } = src;

	if (text.endsWith('.d.ts')) {
		text = text.slice(0, -'.d.ts'.length);
	}
	else if (text.endsWith('.ts')) {
		text = text.slice(0, -'.ts'.length);
	}
	else if (text.endsWith('.tsx')) {
		text = text.slice(0, -'.tsx'.length) + '.jsx';
	}

	if (!text.endsWith('.js') && !text.endsWith('.jsx')) {
		text = text + '.js';
	}

	yield `export * from `;
	yield* generateSfcBlockAttrValue(src, text, {
		...codeFeatures.all,
		navigation: text === src.text
			? true
			: {
				shouldRename: () => false,
				resolveRenameEditText(newName) {
					if (newName.endsWith('.jsx') || newName.endsWith('.js')) {
						newName = newName.split('.').slice(0, -1).join('.');
					}
					if (src?.text.endsWith('.d.ts')) {
						newName = newName + '.d.ts';
					}
					else if (src?.text.endsWith('.ts')) {
						newName = newName + '.ts';
					}
					else if (src?.text.endsWith('.tsx')) {
						newName = newName + '.tsx';
					}
					return newName;
				},
			},
	});
	yield endOfLine;
	yield `export { default } from '${text}'${endOfLine}`;
}
