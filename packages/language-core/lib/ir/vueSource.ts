import type { IScriptSnapshot } from '@volar/language-core';
import type { SFCParseResult } from '@vue/compiler-sfc';
import { computed, signal } from 'alien-signals';
import type { IR, IRPipeline, TypeScript, VueCompilerOptions, VueFormat } from '../types';
import { useIR } from './ir';
import { createScriptAnalysis, type ScriptAnalysis } from './scriptAnalysis';

/**
 * A Vue file read into its IR and script analysis, which update in place when its snapshot changes. It knows
 * nothing of generated code: each consumer, such as the language service or a Content Mapper, builds its own on top.
 */
export function createVueSource(
	ts: TypeScript,
	vueCompilerOptions: VueCompilerOptions,
	pipeline: IRPipeline,
	fileName: string,
	snapshot: IScriptSnapshot,
) {
	return new VueSource(ts, vueCompilerOptions, pipeline, fileName, snapshot);
}

export class VueSource {
	readonly ir: IR;
	readonly analysis: ScriptAnalysis;

	private _snapshot: {
		(): IScriptSnapshot;
		(newSnapshot: IScriptSnapshot): void;
	};
	private _parsedSfcResult: () => ReturnType<typeof this.parseSfc>;

	get snapshot() {
		return this._snapshot();
	}
	get vueSfc() {
		return this._parsedSfcResult()?.result;
	}

	constructor(
		ts: TypeScript,
		readonly vueCompilerOptions: VueCompilerOptions,
		pipeline: IRPipeline,
		readonly fileName: string,
		snapshot: IScriptSnapshot,
	) {
		this._snapshot = signal(snapshot);
		this._parsedSfcResult = computed(lastResult => this.parseSfc(pipeline, lastResult));
		this.ir = useIR(
			ts,
			pipeline,
			fileName,
			this._snapshot,
			() => this._parsedSfcResult()?.result,
		);
		this.analysis = createScriptAnalysis(ts, vueCompilerOptions, fileName, this.ir);
	}

	update(newSnapshot: IScriptSnapshot) {
		this._snapshot(newSnapshot);
	}

	private parseSfc(
		pipeline: IRPipeline,
		lastResult?: {
			snapshot: IScriptSnapshot;
			result: SFCParseResult;
			format: VueFormat;
		},
	) {
		const snapshot = this.snapshot;

		if (lastResult?.format.update && !lastResult.result.errors.length) {
			const change = snapshot.getChangeRange(lastResult.snapshot);
			if (change) {
				const newSfc = lastResult.format.update(lastResult.result, {
					start: change.span.start,
					end: change.span.start + change.span.length,
					newText: snapshot.getText(change.span.start, change.span.start + change.newLength),
				});
				if (newSfc) {
					// force dirty
					newSfc.descriptor = JSON.parse(JSON.stringify(newSfc.descriptor));
					return {
						snapshot,
						format: lastResult.format,
						result: newSfc,
					};
				}
			}
		}

		const content = snapshot.getText(0, snapshot.getLength());
		const parsed = pipeline.parse(this.fileName, content);
		if (parsed) {
			return { snapshot, ...parsed };
		}
	}
}
