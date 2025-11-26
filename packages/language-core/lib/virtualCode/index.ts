import type { CodeMapping, VirtualCode } from '@volar/language-core';
import type { SFCParseResult } from '@vue/compiler-sfc';
import { computed, signal } from 'alien-signals';
import type * as ts from 'typescript';
import { allCodeFeatures } from '../plugins';
import type { Sfc, VueCompilerOptions, VueLanguagePluginReturn } from '../types';
import { useEmbeddedCodes } from './embeddedCodes';
import { useIR } from './ir';

export class VueVirtualCode implements VirtualCode {
	readonly id = 'main';

	private _snapshot: {
		(): ts.IScriptSnapshot;
		(newSnapshot: ts.IScriptSnapshot): void;
	};
	private _parsedSfcResult: () => ReturnType<typeof this.parseSfc>;
	private _ir: Sfc;
	private _embeddedCodes: () => VirtualCode[];
	private _mappings: () => CodeMapping[];

	get snapshot() {
		return this._snapshot();
	}
	get vueSfc() {
		return this._parsedSfcResult()?.result;
	}
	get sfc() {
		return this._ir;
	}
	get embeddedCodes() {
		return this._embeddedCodes();
	}
	get mappings() {
		return this._mappings();
	}

	constructor(
		public fileName: string,
		public languageId: string,
		public initSnapshot: ts.IScriptSnapshot,
		public vueCompilerOptions: VueCompilerOptions,
		plugins: VueLanguagePluginReturn[],
		ts: typeof import('typescript'),
	) {
		this._snapshot = signal(initSnapshot);
		this._parsedSfcResult = computed(lastResult => this.parseSfc(plugins, lastResult));
		this._ir = useIR(
			ts,
			plugins,
			fileName,
			this._snapshot,
			() => this._parsedSfcResult()?.result,
		);
		this._embeddedCodes = useEmbeddedCodes(plugins, fileName, this._ir);
		this._mappings = computed(() => {
			return [{
				sourceOffsets: [0],
				generatedOffsets: [0],
				lengths: [this._snapshot().getLength()],
				data: allCodeFeatures,
			}];
		});
	}

	update(newSnapshot: ts.IScriptSnapshot) {
		this._snapshot(newSnapshot);
	}

	private parseSfc(
		plugins: VueLanguagePluginReturn[],
		lastResult?: {
			snapshot: ts.IScriptSnapshot;
			result: SFCParseResult;
			plugin: VueLanguagePluginReturn;
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

		for (const plugin of plugins) {
			const sfc = plugin.parseSFC2?.(this.fileName, this.languageId, snapshot.getText(0, snapshot.getLength()))
				?? plugin.parseSFC?.(this.fileName, snapshot.getText(0, snapshot.getLength()));
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
