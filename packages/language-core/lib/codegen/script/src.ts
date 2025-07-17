import type { Code, SfcBlockAttr } from '../../types';
import { codeFeatures } from '../codeFeatures';
import { combineLastMapping, endOfLine } from '../utils';
import { wrapWith } from '../utils/wrapWith';

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
	yield* wrapWith(
		src.offset,
		src.offset + src.text.length,
		'main',
		{
			...codeFeatures.all,
			...text !== src.text ? codeFeatures.navigationWithoutRename : {},
		},
		`'`,
		[text.slice(0, src.text.length), 'main', src.offset, combineLastMapping],
		text.slice(src.text.length),
		`'`,
	);
	yield endOfLine;
	yield `export { default } from '${text}'${endOfLine}`;
}
