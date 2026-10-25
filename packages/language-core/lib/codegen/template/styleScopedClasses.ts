import type { SpanMapKind } from '@volar/language-core';
import type * as CompilerDOM from '@vue/compiler-dom';
import type { Code, IRBlock } from '../../types';
import { forEachStyleScopedClassReference } from '../../utils/styleScopedClasses';
import { completionFeatures, navigationFeatures } from '../features';
import { names } from '../names';
import { endOfLine } from '../utils';
import { Boundary, synthesizedIgnore } from '../utils/boundary';
import { generateEscaped } from '../utils/escaped';
import type { TemplateCodegenOptions } from './index';

const classNameEscapeRE = /([\\'])/;

// For language-service/lib/plugins/vue-scoped-class-links.ts usage
export const references: WeakMap<IRBlock, [version: string, [className: string, offset: number][]]> = new WeakMap();

export function* generateStyleScopedClassReferences(
	{ template, typescript: ts }: TemplateCodegenOptions,
	node: CompilerDOM.ElementNode,
): Generator<Code> {
	for (const [className, offset, fullStart, kind] of forEachStyleScopedClassReference(ts, template, node)) {
		yield* generateStyleScopedClassReference(template, className, offset, fullStart, kind);
	}
}

export function* generateStyleScopedClassReference(
	block: IRBlock,
	className: string,
	offset: number,
	fullStart = offset,
	kind?: SpanMapKind,
): Generator<Code> {
	if (!className) {
		yield `/** @type {${names.StyleScopedClasses}['`;
		yield ['', 'template', offset, { features: completionFeatures }];
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
	const ignore = yield* Boundary.start(block.name, 0, 0, synthesizedIgnore);
	const boundary = yield* Boundary.start(
		block.name,
		fullStart,
		offset + className.length,
		{ features: navigationFeatures | completionFeatures, kind },
	);
	yield `'`;
	yield* generateEscaped(
		className,
		block.name,
		offset,
		classNameEscapeRE,
	);
	yield `'`;
	yield boundary.end();
	yield ignore.end();
	yield `]} */${endOfLine}`;
}
