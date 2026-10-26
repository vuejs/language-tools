import type { IRScript, IRScriptSetup } from '@vue/language-core';
import type { TsCode } from '../../boundary';
import type { ScriptEdit } from '../plugin';

export interface CodeTransform {
	range: [start: number, end: number];
	generate(): Iterable<TsCode>;
	/** The `name` of the plugin entry that the transform is a script edit of; a transform of Vue has none. */
	plugin?: string;
}

export function replace(start: number, end: number, replacement: () => Iterable<TsCode>): CodeTransform {
	return {
		range: [start, end],
		generate: replacement,
	};
}

export function insert(position: number, insertion: () => Iterable<TsCode>): CodeTransform {
	return {
		range: [position, position],
		generate: insertion,
	};
}

/**
 * Generates `start`..`end` with the transforms applied in a total order: by start, inserts before a replace at the
 * same position, transforms of Vue before script edits of plugins, then in the order given. A script edit may touch
 * the range of another transform but not overlap it: one that overlaps a transform of Vue fails the generation, and
 * one that overlaps an earlier script edit is dropped. `section` generates the user code between the transforms, and
 * is not called for an empty range.
 */
export function* generateCodeWithTransforms(
	start: number,
	end: number,
	transforms: CodeTransform[],
	section: (start: number, end: number) => Iterable<TsCode>,
): Generator<TsCode> {
	const sortedTransforms = transforms
		.map((transform, index) => ({ transform, index }))
		.sort((a, b) =>
			a.transform.range[0] - b.transform.range[0]
			|| Number(isReplace(a.transform)) - Number(isReplace(b.transform))
			|| Number(a.transform.plugin !== undefined) - Number(b.transform.plugin !== undefined)
			|| a.index - b.index
		);
	// the applied transform that ends last
	let covering: CodeTransform | undefined;
	for (const { transform } of sortedTransforms) {
		const { range, generate } = transform;
		if (covering && range[0] < covering.range[1]) {
			if (transform.plugin !== undefined && covering.plugin !== undefined) {
				continue;
			}
			if (transform.plugin !== undefined || covering.plugin !== undefined) {
				const [edit, core] = transform.plugin !== undefined ? [transform, covering] : [covering, transform];
				throw new Error(
					`Plugin '${edit.plugin}': the script edit at ${edit.range[0]}..${
						edit.range[1]
					} overlaps a code transform of Vue at ${core.range[0]}..${core.range[1]}.`,
				);
			}
		}
		yield* generateSection(start, range[0]);
		yield* generate();
		start = range[1];
		if (!covering || range[1] >= covering.range[1]) {
			covering = transform;
		}
	}
	yield* generateSection(start, end);

	function* generateSection(start: number, end: number) {
		if (start < end) {
			yield* section(start, end);
		}
	}
}

/**
 * The script edits of `block` as code transforms of the copies of its `sections`, each a range of its content. An
 * edit belongs to the first section that contains it, so the order of `sections` decides which copy a zero-width
 * edit at a shared boundary goes to. An edit that no section contains fails the generation.
 */
export function getScriptEditTransforms(
	edits: readonly ScriptEdit[],
	block: IRScript | IRScriptSetup,
	sections: readonly (readonly [start: number, end: number])[],
): CodeTransform[][] {
	const transforms = sections.map((): CodeTransform[] => []);
	for (const edit of edits) {
		if (edit.block !== block) {
			continue;
		}
		const index = sections.findIndex(([start, end]) => start <= edit.start && edit.end <= end);
		if (index < 0) {
			throw new Error(
				`Plugin '${edit.plugin}': the script edit at ${edit.start}..${edit.end} spans sections of the block that Vue copies to different places.`,
			);
		}
		transforms[index]!.push({ range: [edit.start, edit.end], generate: () => edit.code, plugin: edit.plugin });
	}
	return transforms;
}

function isReplace(transform: CodeTransform) {
	return transform.range[0] !== transform.range[1];
}
