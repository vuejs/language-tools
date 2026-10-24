import type { Code, IRAttr } from '../../types';
import { codeFeatures, ignoreDiagnostics } from '../codeFeatures';
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
		yield [className, source, offset + 1, ignoreDiagnostics(codeFeatures.navigation)];
	}
	else {
		const boundary = yield* Boundary.start(
			source,
			offset,
			offset + classNameWithDot.length,
			ignoreDiagnostics(codeFeatures.navigation),
		);
		yield `'`;
		yield [className, source, offset + 1, undefined];
		yield `'`;
		yield boundary.end();
	}
	yield `: ${propertyType}`;
	yield ` }`;
}

export function* generateStyleSrc(src: Exclude<IRAttr, true>): Generator<Code> {
	const boundary = yield* Boundary.start(
		'main',
		src.offset,
		src.offset + src.text.length,
		codeFeatures.navigation,
	);
	yield `'`;
	yield [src.text, 'main', src.offset, undefined];
	yield `'`;
	yield boundary.end();
}
