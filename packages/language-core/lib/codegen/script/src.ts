import type { Code, SfcBlockAttr, VueCodeInformation } from '../../types';
import { codeFeatures } from '../codeFeatures';
import { endOfLine } from '../utils';
import { endBoundary, startBoundary } from '../utils/boundary';

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
	const wrapCodeFeatures: VueCodeInformation = {
		...codeFeatures.all,
		...text !== src.text ? codeFeatures.navigationWithoutRename : {},
	};
	const token = yield* startBoundary('main', src.offset, wrapCodeFeatures);
	yield `'`;
	yield [text.slice(0, src.text.length), 'main', src.offset, { __combineToken: token }];
	yield text.slice(src.text.length);
	yield `'`;
	yield endBoundary(token, src.offset + src.text.length);
	yield endOfLine;
	yield `export { default } from '${text}'${endOfLine}`;
}
