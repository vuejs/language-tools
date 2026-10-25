import type { SpanMapKind } from '@volar/language-core';
import type * as CompilerDOM from '@vue/compiler-dom';
import { completionFeatures, navigationFeatures } from '../../features';
import type { Code, IRBlock } from '../../types';
import { Boundary, synthesizedIgnore } from '../../utils/boundary';
import { forEachStyleScopedClassReference } from '../../utils/styleScopedClasses';
import { names } from '../names';
import { endOfLine } from '../utils';
import { generateEscaped } from '../utils/escaped';
import type { TemplateCodegenOptions } from './index';

const classNameEscapeRE = /([\\'])/;

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
