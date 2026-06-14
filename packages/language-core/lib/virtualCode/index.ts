import type { CodeMapping, VirtualCode } from '@volar/language-core';
import { computed, signal } from 'alien-signals';
import type * as ts from 'typescript';
import { allCodeFeatures } from '../plugins';
import type { IR, VueCompilerOptions, VueLanguagePluginReturn } from '../types';
import { useEmbeddedCodes } from './embeddedCodes';
import { useIR } from './ir';
import type { RawIRParseResult } from './rawIr';

export class VueVirtualCode implements VirtualCode {
	readonly id = 'main';

	private _snapshot: {
		(): ts.IScriptSnapshot;
		(newSnapshot: ts.IScriptSnapshot): void;
	};
	private _parsedSfcResult: () => ReturnType<typeof this.parseSfc>;
	private _ir: IR;
	private _embeddedCodes: () => VirtualCode[];
	private _mappings: () => CodeMapping[];

	get snapshot() {
		return this._snapshot();
	}
	get parsed() {
		return this._parsedSfcResult()?.result;
	}
	get ir() {
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
			() => this._parsedSfcResult()?.result.rawIr,
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
			result: RawIRParseResult;
			plugin: VueLanguagePluginReturn;
		},
	) {
		const snapshot = this.snapshot;

		if (lastResult?.plugin.updateSFC && !lastResult.result.errors.length) {
			const change = snapshot.getChangeRange(lastResult.snapshot);
			if (change) {
				const newResult = lastResult.plugin.updateSFC(lastResult.result, {
					start: change.span.start,
					end: change.span.start + change.span.length,
					newText: snapshot.getText(change.span.start, change.span.start + change.newLength),
				});
				if (newResult) {
					// force dirty
					newResult.rawIr = JSON.parse(JSON.stringify(newResult.rawIr));
					return {
						snapshot,
						plugin: lastResult.plugin,
						result: newResult,
					};
				}
			}
		}

		for (const plugin of plugins) {
			const result = plugin.parseSFC?.(this.fileName, this.languageId, snapshot.getText(0, snapshot.getLength()));
			if (result) {
				return {
					snapshot,
					plugin,
					result,
				};
			}
		}
	}
}
