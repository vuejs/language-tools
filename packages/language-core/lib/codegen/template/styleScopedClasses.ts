import type { Code, SfcBlock } from '../../types';
import { codeFeatures } from '../codeFeatures';
import { names } from '../names';
import { endOfLine } from '../utils';
import { endBoundary, startBoundary } from '../utils/boundary';
import { generateEscaped } from '../utils/escaped';

const classNameEscapeRegex = /([\\'])/;

// For language-service/lib/plugins/vue-scoped-class-links.ts usage
export const references: WeakMap<SfcBlock, [version: string, [className: string, offset: number][]]> = new WeakMap();

export function* generateStyleScopedClassReference(
	block: SfcBlock,
	className: string,
	offset: number,
	fullStart = offset,
): Generator<Code> {
	if (!className) {
		yield `/** @type {${names.StyleScopedClasses}['`;
		yield ['', 'template', offset, codeFeatures.completion];
		yield `']} */${endOfLine}`;
		return;
	}

	const cache = references.get(block);
	if (!cache || cache[0] !== block.content) {
		const arr: [className: string, offset: number][] = [];
		references.set(block, [block.content, arr]);
		arr.push([className, offset]);
	}
	else {
		cache[1].push([className, offset]);
	}

	yield `/** @type {${names.StyleScopedClasses}[`;
	const token = yield* startBoundary(block.name, fullStart, codeFeatures.navigation);
	yield `'`;
	yield* generateEscaped(
		className,
		block.name,
		offset,
		codeFeatures.navigationAndCompletion,
		classNameEscapeRegex,
	);
	yield `'`;
	yield endBoundary(token, offset + className.length);
	yield `]} */${endOfLine}`;
}
