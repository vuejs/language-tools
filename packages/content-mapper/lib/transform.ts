import { type IR, resolveCodeOffsets } from '@vue/language-core';
import { toString } from 'muggle-string';
import { getUnusedExpectErrorMessage } from '../localization';
import type { SpanMapping, TransformResult } from '../protocol';
import { toSpanMappings } from '../spanMappings';
import { buildDiagnosticDirectives, buildMappings } from './buildMappings';
import type { ServiceScript } from './codegen';

/** The transform result of a service script generated from `ir`, whose source text is `content`. */
export function toTransformResult(
	script: ServiceScript,
	ir: IR,
	content: string,
	languageFeatures: boolean,
): TransformResult {
	const codes = resolveCodeOffsets(ir, script.codes);
	const text = toString(codes);
	const mappings = toSpanMappings(buildMappings(codes), text, content, languageFeatures);
	return {
		text,
		extension: `.${script.lang}`,
		diagnosticDirectives: {
			unusedExpectDirectiveDiagnostics: [{
				code: 2578,
				messageText: getUnusedExpectErrorMessage(),
			}],
			directives: buildDiagnosticDirectives(codes, getUnmappedRanges(text.length, mappings)),
		},
		mappings,
	};
}

/** The ranges of the virtual text that no mapping covers, whose diagnostics are not the user's. */
export function getUnmappedRanges(virtualLength: number, mappings: readonly SpanMapping[]) {
	const unmapped: [start: number, end: number][] = [];
	let virtualStart = 0;
	for (const [start, length] of mappings) {
		if (length) {
			if (virtualStart < start) {
				unmapped.push([virtualStart, start]);
			}
			virtualStart = start + length;
		}
	}
	if (virtualStart < virtualLength) {
		unmapped.push([virtualStart, virtualLength]);
	}
	return unmapped;
}
