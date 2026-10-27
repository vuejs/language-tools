import { SpanMapFeature } from '@volar/language-core';
import { type IRAttr, navigationFeatures } from '@vue/language-core';
import { Boundary, synthesizedIgnore, type TsCode } from '../tsCode';
import { identifierRE, newLine } from '../writers';

/** The features whose results span a quoted name without its quotes. */
const quotedNameFeatures = SpanMapFeature.References | SpanMapFeature.DocumentHighlights | SpanMapFeature.Rename;

export function* generateClassProperty(
	source: string,
	classNameWithDot: string,
	offset: number,
	propertyType: string,
): Generator<TsCode> {
	const className = classNameWithDot.slice(1);
	const start = offset + 1;
	// An unquoted name maps verbatim, so it can be both a definition and renamed.
	if (identifierRE.test(className)) {
		yield* generateMember(source, [[className, source, start, { features: navigationFeatures }]], propertyType);
		return;
	}
	// TypeScript gives a definition the span of the quoted name and a reference the span inside the quotes; as a
	// segment inside another one keeps the outer one from mapping a span, the name is declared once for each.
	// Interim: declaring the name twice only works around TypeScript, which drops a result that falls in more than
	// one segment and gives one quoted name two spans. The right fix is for TypeScript to map such a result, or to
	// give the definition and the references of a quoted name the same span; once it does either, declare the name
	// once again, as a single Atom over the quoted key.
	yield* generateMember(source, generateQuotedDefinition(source, className, start), propertyType);
	yield* generateMember(source, [
		`'`,
		[className, source, start, { features: navigationFeatures & quotedNameFeatures }],
		`'`,
	], propertyType);
}

function* generateQuotedDefinition(source: string, className: string, start: number): Generator<TsCode> {
	const boundary = yield* Boundary.start(source, start, start + className.length, {
		features: navigationFeatures & ~quotedNameFeatures,
	});
	yield `'`;
	yield [className, source, start, undefined];
	yield `'`;
	yield boundary.end();
}

function* generateMember(source: string, name: Iterable<TsCode>, propertyType: string): Generator<TsCode> {
	yield `${newLine} & { `;
	const ignore = yield* Boundary.start(source, 0, 0, synthesizedIgnore);
	yield* name;
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
