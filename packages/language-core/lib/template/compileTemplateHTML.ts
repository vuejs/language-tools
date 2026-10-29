import { SpanMap } from '@volar/language-core';
import type * as CompilerDOM from '@vue/compiler-dom';
import type { TemplateHTML } from '../types';
import { compileTemplate } from './compileTemplate';

/** Compiles the HTML of a template language into an AST at the offsets of the template (see `TemplateHTML`). */
export function compileTemplateHTML(
	{ html, mappings, ignoreError }: TemplateHTML,
	options: CompilerDOM.CompilerOptions,
): CompilerDOM.RootNode {
	const errors: CompilerDOM.CompilerError[] = [];
	const warnings: CompilerDOM.CompilerError[] = [];
	const ast = compileTemplate(html, {
		...options,
		onError(error) {
			if (!ignoreError?.(error)) {
				errors.push(error);
			}
		},
		onWarn(warning) {
			warnings.push(warning);
		},
	});

	const locs = new Set<CompilerDOM.SourceLocation>();
	const visited = new Set<object>();
	collectLocs(ast);
	for (const { loc } of [...errors, ...warnings]) {
		if (loc) {
			locs.add(loc);
		}
	}

	const map = new SpanMap(mappings);
	const sourceOffsets = new Map<CompilerDOM.Position, number>();
	for (const loc of locs) {
		for (const position of [loc.start, loc.end]) {
			if (!sourceOffsets.has(position)) {
				sourceOffsets.set(position, toSourceOffset(position.offset));
			}
		}
	}
	for (const loc of locs) {
		const start = sourceOffsets.get(loc.start)!;
		const end = sourceOffsets.get(loc.end)!;
		if ((start === -1) !== (end === -1)) {
			// the positions can be shared with locations that have a source
			loc.start = { ...loc.start, offset: -1 };
			loc.end = { ...loc.end, offset: -1 };
		}
		else {
			loc.start.offset = start;
			loc.end.offset = end;
		}
	}

	for (const error of errors) {
		options.onError?.(error);
	}
	for (const warning of warnings) {
		options.onWarn?.(warning);
	}
	return ast;

	function collectLocs(obj: object) {
		if (visited.has(obj)) {
			return;
		}
		visited.add(obj);
		if (isLoc(obj)) {
			locs.add(obj);
			return;
		}
		for (const key in obj) {
			const value = (obj as Record<string, unknown>)[key];
			if (value && typeof value === 'object') {
				collectLocs(value);
			}
		}
	}

	function toSourceOffset(htmlOffset: number) {
		let offset = -1;
		for (const { position } of map.virtualToOriginalPositions(htmlOffset)) {
			offset = Math.max(offset, position);
		}
		return offset;
	}
}

function isLoc(obj: any): obj is CompilerDOM.SourceLocation {
	return typeof obj.start?.offset === 'number' && typeof obj.end?.offset === 'number' && typeof obj.source === 'string';
}
