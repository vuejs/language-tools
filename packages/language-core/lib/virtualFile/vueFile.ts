import type { CodeMapping, VirtualCode } from '@volar/language-core';
import { computed, signal } from 'alien-signals';
import type * as ts from 'typescript';
import { allCodeFeatures } from '../plugins';
import type { Sfc, SFCParseResult, VueCompilerOptions, VueLanguagePluginReturn } from '../types';
import { computedEmbeddedCodes } from './computedEmbeddedCodes';
import { computedSfc } from './computedSfc';
import { computedVueSfc } from './computedVueSfc';

export class VueVirtualCode implements VirtualCode {

	id = 'main';

	private _snapshot = signal<ts.IScriptSnapshot>(undefined!);
	private _vueSfc: () => SFCParseResult | undefined;
	private _sfc: Sfc;
	private _embeddedCodes: () => VirtualCode[];
	private _mappings: () => CodeMapping[];

	constructor(
		public fileName: string,
		public languageId: string,
		public initSnapshot: ts.IScriptSnapshot,
		public vueCompilerOptions: VueCompilerOptions,
		public plugins: VueLanguagePluginReturn[],
		public ts: typeof import('typescript'),
	) {
		this._snapshot(initSnapshot);
		this._vueSfc = computedVueSfc(this.plugins, this.fileName, this.languageId, this._snapshot);
		this._sfc = computedSfc(this.ts, this.plugins, this.fileName, this._snapshot, this._vueSfc);
		this._embeddedCodes = computedEmbeddedCodes(this.plugins, this.fileName, this._sfc);
		this._mappings = computed(() => {
			const snapshot = this._snapshot();
			return [{
				sourceOffsets: [0],
				generatedOffsets: [0],
				lengths: [snapshot.getLength()],
				data: allCodeFeatures,
			}];
		});
	}

	get snapshot() {
		return this._snapshot();
	}
	get vueSfc() {
		return this._vueSfc();
	}
	get sfc() {
		return this._sfc;
	}
	get embeddedCodes() {
		return this._embeddedCodes();
	}
	get mappings() {
		return this._mappings();
	}

	update(newSnapshot: ts.IScriptSnapshot) {
		this._snapshot(newSnapshot);
	}
}
