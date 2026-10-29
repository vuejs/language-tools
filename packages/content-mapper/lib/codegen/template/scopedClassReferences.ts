import type { SpanMapKind } from '@volar/language-core';
import type * as CompilerDOM from '@vue/compiler-dom';
import {
	completionFeatures,
	forEachStyleScopedClassReference,
	type IRBlock,
	navigationFeatures,
} from '@vue/language-core';
import { names } from '../names';
import { Boundary, synthesizedIgnore, type TsCode } from '../tsCode';
import { endOfLine, typeAliasRef } from '../writers';
import { generateEscaped } from '../writers/escaped';
import type { TemplateCodegenOptions } from './index';

const classNameEscapeRE = /([\\'])/;

export function* generateStyleScopedClassReferences(
	{ template, typescript: ts, scriptLang }: TemplateCodegenOptions,
	node: CompilerDOM.ElementNode,
): Generator<TsCode> {
	for (const [className, offset, fullStart, kind] of forEachStyleScopedClassReference(ts, template, node)) {
		yield* generateStyleScopedClassReference(template, scriptLang, className, offset, fullStart, kind);
	}
}

export function* generateStyleScopedClassReference(
	block: IRBlock,
	scriptLang: string,
	className: string,
	offset: number,
	fullStart = offset,
	kind?: SpanMapKind,
): Generator<TsCode> {
	if (!className) {
		yield `/** @type {${typeAliasRef(names.StyleScopedClasses, scriptLang)}['`;
		yield ['', block, offset, { features: completionFeatures }];
		yield `']} */${endOfLine}`;
		return;
	}

	yield `/** @type {${typeAliasRef(names.StyleScopedClasses, scriptLang)}[`;
	const ignore = yield* Boundary.start(block, 0, 0, synthesizedIgnore);
	const boundary = yield* Boundary.start(
		block,
		fullStart,
		offset + className.length,
		{ features: navigationFeatures | completionFeatures, kind },
	);
	yield `'`;
	yield* generateEscaped(
		className,
		block,
		offset,
		classNameEscapeRE,
	);
	yield `'`;
	yield boundary.end();
	yield ignore.end();
	yield `]} */${endOfLine}`;
}
