import { type IRAttr, navigationFeatures } from '@vue/language-core';
import { Boundary, synthesizedIgnore, type TsCode } from '../../boundary';
import { identifierRE, newLine } from '../utils';

export function* generateClassProperty(
	source: string,
	classNameWithDot: string,
	offset: number,
	propertyType: string,
): Generator<TsCode> {
	yield `${newLine} & { `;
	const className = classNameWithDot.slice(1);
	// An unquoted name maps verbatim, so it can be both a definition and renamed.
	const ignore = yield* Boundary.start(source, 0, 0, synthesizedIgnore);
	if (identifierRE.test(className)) {
		yield [className, source, offset + 1, { features: navigationFeatures }];
	}
	else {
		const boundary = yield* Boundary.start(
			source,
			offset,
			offset + classNameWithDot.length,
			{ features: navigationFeatures },
		);
		yield `'`;
		yield [className, source, offset + 1, undefined];
		yield `'`;
		yield boundary.end();
	}
	yield ignore.end();
	yield `: ${propertyType}`;
	yield ` }`;
}

export function* generateStyleSrc(src: Exclude<IRAttr, true>): Generator<TsCode> {
	const boundary = yield* Boundary.start(
		'main',
		src.offset,
		src.offset + src.text.length,
		{ features: navigationFeatures },
	);
	yield `'`;
	yield [src.text, 'main', src.offset, undefined];
	yield `'`;
	yield boundary.end();
}
