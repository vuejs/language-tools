import type { IScriptSnapshot } from '@volar/language-core';
import type { SFCParseResult } from '@vue/compiler-sfc';
import { computed, signal } from 'alien-signals';
import { createScriptAnalysis, type ScriptAnalysis } from './scriptAnalysis';
import type { IR, TypeScript, VueCompilerOptions, VueLanguagePluginReturn } from './types';
import { useIR } from './virtualCode/ir';
import { petiteVueParser } from './virtualCode/parsers/petiteVue';
import { sfcParser } from './virtualCode/parsers/sfc';
import { vitePressParser } from './virtualCode/parsers/vitepress';

type SfcParser = Pick<VueLanguagePluginReturn, 'parseSFC' | 'updateSFC'>;

const builtInParsers: Record<VueCompilerOptions['format'], SfcParser> = {
	sfc: sfcParser,
	vitepress: vitePressParser,
	'petite-vue': petiteVueParser,
};

/**
 * A Vue file read into its IR and script analysis, which update in place when its snapshot changes. It knows
 * nothing of generated code: each consumer, such as the language service or a Content Mapper, builds its own on top.
 */
export function createVueSource(
	ts: TypeScript,
	vueCompilerOptions: VueCompilerOptions,
	plugins: VueLanguagePluginReturn[],
	fileName: string,
	snapshot: IScriptSnapshot,
) {
	return new VueSource(ts, vueCompilerOptions, plugins, fileName, snapshot);
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
		plugins: VueLanguagePluginReturn[],
		readonly fileName: string,
		snapshot: IScriptSnapshot,
	) {
		this._snapshot = signal(snapshot);
		this._parsedSfcResult = computed(lastResult => this.parseSfc(plugins, lastResult));
		this.ir = useIR(
			ts,
			plugins,
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
		plugins: VueLanguagePluginReturn[],
		lastResult?: {
			snapshot: IScriptSnapshot;
			result: SFCParseResult;
			plugin: SfcParser;
		},
	) {
		const snapshot = this.snapshot;

		if (lastResult?.plugin.updateSFC && !lastResult.result.errors.length) {
			const change = snapshot.getChangeRange(lastResult.snapshot);
			if (change) {
				const newSfc = lastResult.plugin.updateSFC(lastResult.result, {
					start: change.span.start,
					end: change.span.start + change.span.length,
					newText: snapshot.getText(change.span.start, change.span.start + change.newLength),
				});
				if (newSfc) {
					// force dirty
					newSfc.descriptor = JSON.parse(JSON.stringify(newSfc.descriptor));
					return {
						snapshot,
						plugin: lastResult.plugin,
						result: newSfc,
					};
				}
			}
		}

		const content = snapshot.getText(0, snapshot.getLength());
		for (const plugin of [...plugins, builtInParsers[this.vueCompilerOptions.format] ?? sfcParser]) {
			const sfc = plugin.parseSFC?.(this.fileName, content);
			if (sfc) {
				return {
					snapshot,
					plugin,
					result: sfc,
				};
			}
		}
	}
}
