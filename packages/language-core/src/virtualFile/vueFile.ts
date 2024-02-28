import { Stack, VirtualCode } from '@volar/language-core';
import type * as ts from 'typescript';
import { VueCompilerOptions, VueLanguagePlugin } from '../types';
import { computedFiles } from './computedFiles';
import { computedMappings } from './computedMappings';
import { computedSfc } from './computedSfc';
import { computedVueSfc } from './computedVueSfc';
import { Signal, signal } from 'computeds';

export class VueGeneratedCode implements VirtualCode {

	// sources

	id = 'main';

	_snapshot: Signal<ts.IScriptSnapshot>;

	// computeds

	getVueSfc = computedVueSfc(this.plugins, this.fileName, () => this._snapshot());
	sfc = computedSfc(this.ts, this.plugins, this.fileName, () => this._snapshot(), this.getVueSfc);
	getMappings = computedMappings(() => this._snapshot(), this.sfc);
	getEmbeddedCodes = computedFiles(this.plugins, this.fileName, this.sfc, this.codegenStack);

	// others

	codegenStacks: Stack[] = [];
	get embeddedCodes() {
		return this.getEmbeddedCodes();
	}
	get snapshot() {
		return this._snapshot();
	}
	get mappings() {
		return this.getMappings();
	}

	constructor(
		public fileName: string,
		public languageId: string,
		public initSnapshot: ts.IScriptSnapshot,
		public vueCompilerOptions: VueCompilerOptions,
		public plugins: ReturnType<VueLanguagePlugin>[],
		public ts: typeof import('typescript'),
		public codegenStack: boolean,
	) {
		this._snapshot = signal(initSnapshot);
	}

	update(newSnapshot: ts.IScriptSnapshot) {
		this._snapshot.set(newSnapshot);
	}
}
