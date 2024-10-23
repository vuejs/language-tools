import type { VirtualCode } from '@volar/language-core';
import { computed, signal } from 'alien-signals';
import type * as ts from 'typescript';
import { allCodeFeatures } from '../plugins';
import type { VueCompilerOptions, VueLanguagePluginReturn } from '../types';
import { computedEmbeddedCodes } from './computedEmbeddedCodes';
import { computedSfc } from './computedSfc';
import { computedVueSfc } from './computedVueSfc';

export class VueVirtualCode implements VirtualCode {

	// sources

	id = 'main';

	_snapshot = signal<ts.IScriptSnapshot>(undefined!);

	// computeds

	_vueSfc = computedVueSfc(this.plugins, this.fileName, this.languageId, this._snapshot);
	_sfc = computedSfc(this.ts, this.plugins, this.fileName, this._snapshot, this._vueSfc);
	_mappings = computed(() => {
		const snapshot = this._snapshot.get();
		return [{
			sourceOffsets: [0],
			generatedOffsets: [0],
			lengths: [snapshot.getLength()],
			data: allCodeFeatures,
		}];
	});
	_embeddedCodes = computedEmbeddedCodes(this.plugins, this.fileName, this._sfc);

	// others

	get embeddedCodes() {
		return this._embeddedCodes.get();
	}
	get snapshot() {
		return this._snapshot.get();
	}
	get mappings() {
		return this._mappings.get();
	}

	constructor(
		public fileName: string,
		public languageId: string,
		public initSnapshot: ts.IScriptSnapshot,
		public vueCompilerOptions: VueCompilerOptions,
		public plugins: VueLanguagePluginReturn[],
		public ts: typeof import('typescript'),
	) {
		this._snapshot.set(initSnapshot);
	}

	update(newSnapshot: ts.IScriptSnapshot) {
		this._snapshot.set(newSnapshot);
	}
}
