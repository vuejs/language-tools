import type * as CompilerDOM from '@vue/compiler-dom';
import type { TemplateHTML } from '../types';
import { compileTemplate } from './compileTemplate';

/** Compiles the HTML of a template language into an AST at the offsets of the template (see `TemplateHTML`). */
export function compileTemplateHTML(
	{ pieces, ignoreError }: TemplateHTML,
	template: string,
	options: CompilerDOM.CompilerOptions,
): CompilerDOM.RootNode {
	let html = '';
	/** The greatest template offset of each offset of `html`, if a range covers it. */
	const templateOffsets: number[] = [];
	for (const piece of pieces) {
		if (typeof piece === 'string') {
			html += piece;
			continue;
		}
		const text = piece.text ?? template.slice(piece.start, piece.end);
		for (let i = 0; i <= text.length; i++) {
			const offset = Math.min(piece.start + i, piece.end);
			if ((templateOffsets[html.length + i] ?? -1) < offset) {
				templateOffsets[html.length + i] = offset;
			}
		}
		html += text;
	}
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

	const sourceOffsets = new Map<CompilerDOM.Position, number>();
	for (const loc of locs) {
		for (const position of [loc.start, loc.end]) {
			if (!sourceOffsets.has(position)) {
				sourceOffsets.set(position, templateOffsets[position.offset] ?? -1);
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
}

function isLoc(obj: any): obj is CompilerDOM.SourceLocation {
	return typeof obj.start?.offset === 'number' && typeof obj.end?.offset === 'number' && typeof obj.source === 'string';
}
