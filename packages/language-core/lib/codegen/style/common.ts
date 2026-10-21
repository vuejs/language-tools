import type { Code, IRStyle } from '../../types';
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

export function* generateStyleImports(style: IRStyle): Generator<Code> {
	if (typeof style.src === 'object') {
		yield `${newLine} & typeof import(`;
		const boundary = yield* Boundary.start(
			'main',
			style.src.offset,
			style.src.offset + style.src.text.length,
			codeFeatures.navigationAndVerification,
		);
		yield `'`;
		yield [style.src.text, 'main', style.src.offset, boundary.features];
		yield `'`;
		yield boundary.end();
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
