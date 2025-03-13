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
		...text === src.text ? codeFeatures.navigation : codeFeatures.navigationWithoutRename,
	});
	yield endOfLine;
	yield `export { default } from '${text}'${endOfLine}`;
}
