import type { Code, IRAttr, IRStyle } from '../../types';
import { codeFeatures } from '../codeFeatures';
import { identifierRE, newLine } from '../utils';
import { Boundary } from '../utils/boundary';

export function* generateClassProperty(
	source: string,
	classNameWithDot: string,
	offset: number,
	propertyType: string,
): Generator<Code> {
	yield `${newLine} & { `;
	const className = classNameWithDot.slice(1);
	// An unquoted name maps verbatim, so it can be both a definition and renamed.
	if (identifierRE.test(className)) {
		yield [className, source, offset + 1, codeFeatures.navigation];
	}
	else {
		const boundary = yield* Boundary.start(
			source,
			offset,
			offset + classNameWithDot.length,
			codeFeatures.navigation,
		);
		yield `'`;
		yield [className, source, offset + 1, boundary.features];
		yield `'`;
		yield boundary.end();
	}
	yield `: ${propertyType}`;
	yield ` }`;
}

export function* generateStyleImports(style: IRStyle, includeSrc = true): Generator<Code> {
	if (includeSrc && typeof style.src === 'object') {
		yield `${newLine} & typeof import(`;
		yield* generateStyleSrc(style.src);
		yield `).default`;
	}
	for (const { text, offset } of style.imports) {
		yield `${newLine} & typeof import('`;
		yield [
			text,
			style.name,
			offset,
			codeFeatures.navigationAndVerification,
		];
		yield `').default`;
	}
}

export function* generateStyleSrc(src: Exclude<IRAttr, true>): Generator<Code> {
	const boundary = yield* Boundary.start(
		'main',
		src.offset,
		src.offset + src.text.length,
		codeFeatures.navigationAndVerification,
	);
	yield `'`;
	yield [src.text, 'main', src.offset, boundary.features];
	yield `'`;
	yield boundary.end();
}
