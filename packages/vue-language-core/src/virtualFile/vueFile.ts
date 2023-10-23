import { FileCapabilities, FileKind, VirtualFile, forEachEmbeddedFile } from '@volar/language-core';
import { Stack } from '@volar/source-map';
import type * as ts from 'typescript/lib/tsserverlibrary';
import { VueCompilerOptions, VueLanguagePlugin } from '../types';
import { computedFiles } from './computedFiles';
import { computedMappings } from './computedMappings';
import { computedSfc } from './computedSfc';
import { computedVueSfc } from './computedVueSfc';
import { Signal, computed, signal } from 'computeds';

const jsxReg = /^\.(js|ts)x?$/;

export class VueFile implements VirtualFile {

	// sources

	__snapshot: Signal<ts.IScriptSnapshot>;

	// computeds

	_snapshot = computed(() => this.__snapshot());
	vueSfc = computedVueSfc(this.plugins, this.fileName, this._snapshot);
	sfc = computedSfc(this.ts, this.plugins, this.fileName, this._snapshot, this.vueSfc);
	_mappings = computedMappings(this._snapshot, this.sfc);
	_embeddedFiles = computedFiles(this.plugins, this.fileName, this.sfc, this.codegenStack);

	// others

	capabilities = FileCapabilities.full;
	kind = FileKind.TextFile;
	codegenStacks: Stack[] = [];
	get embeddedFiles() {
		return this._embeddedFiles();
	}
	get mainScriptName() {
		let res: string = '';
		forEachEmbeddedFile(this, file => {
			if (file.kind === FileKind.TypeScriptHostFile && file.fileName.replace(this.fileName, '').match(jsxReg)) {
				res = file.fileName;
			}
		});
		return res;
	}
	get snapshot() {
		return this._snapshot();
	}
	get mappings() {
		return this._mappings();
	}

	constructor(
		public fileName: string,
		public initSnapshot: ts.IScriptSnapshot,
		public vueCompilerOptions: VueCompilerOptions,
		public plugins: ReturnType<VueLanguagePlugin>[],
		public ts: typeof import('typescript/lib/tsserverlibrary'),
		public codegenStack: boolean,
	) {
		this.__snapshot = signal(initSnapshot);
	}

	update(newSnapshot: ts.IScriptSnapshot) {
		this.__snapshot.set(newSnapshot);
	}
}
