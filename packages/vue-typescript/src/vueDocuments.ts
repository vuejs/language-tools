import { computed, shallowReactive } from '@vue/reactivity';
import type { Embedded, EmbeddedFile, VueFile } from './vueDocument';
import type { EmbeddedFileSourceMap, Teleport } from './utils/sourceMaps';
import { untrack } from './utils/untrack';
import * as shared from '@volar/shared';
import * as path from 'upath';
import * as localTypes from './utils/localTypes';
import type { EmbeddedFileMappingData } from '@volar/vue-code-gen';
import type * as _0 from 'typescript/lib/tsserverlibrary'; // fix build failed

export interface VueFiles extends ReturnType<typeof createVueFiles> { }

export function createVueFiles() {

	const _vueFiles = shallowReactive<Record<string, VueFile>>({});
	const vueFiles = shared.createPathMap<VueFile>({
		delete: key => delete _vueFiles[key],
		get: key => _vueFiles[key],
		has: key => !!_vueFiles[key],
		set: (key, value) => _vueFiles[key] = value,
		clear: () => {
			for (var key in _vueFiles) {
				if (_vueFiles.hasOwnProperty(key)) {
					delete _vueFiles[key];
				}
			}
		},
		values: () => new Set(Object.values(_vueFiles)).values(),
	});

	const all = computed(() => Object.values(_vueFiles));
	const fileNames = computed(() => all.value.map(sourceFile => sourceFile.fileName));
	const embeddedDocumentsMap = computed(() => {

		const map = new WeakMap<EmbeddedFile, VueFile>();

		for (const sourceFile of all.value) {
			for (const embedded of sourceFile.refs.allEmbeddeds.value) {
				map.set(embedded.file, sourceFile);
			}
		}

		return map;
	});
	const sourceMapsByFileNameAndLsType = computed(() => {

		const nonTs = new Map<string, Embedded>();
		const script = new Map<string, Embedded>();
		const template = new Map<string, Embedded>();

		for (const sourceFile of all.value) {
			for (const embedded of sourceFile.refs.allEmbeddeds.value) {
				if (embedded.file.lsType === 'nonTs') {
					nonTs.set(embedded.file.fileName, embedded);
				}
				else if (embedded.file.lsType === 'script') {
					script.set(embedded.file.fileName, embedded);
				}
				else if (embedded.file.lsType === 'template') {
					template.set(embedded.file.fileName, embedded);
				}
			}
		}

		return {
			nonTs,
			script,
			template,
		};
	});
	const tsTeleports = {
		template: computed(() => {
			const map = new Map<string, Teleport>();
			for (const key in _vueFiles) {
				const sourceFile = _vueFiles[key]!;
				for (const { file, teleport } of sourceFile.refs.templateLsTeleports.value) {
					map.set(file.fileName, teleport);
				}
			}
			return map;
		}),
		script: computed(() => {
			const map = new Map<string, Teleport>();
			for (const key in _vueFiles) {
				const sourceFile = _vueFiles[key]!;
				const embeddedFile = sourceFile.refs.sfcScriptForScriptLs.file.value;
				const sourceMap = sourceFile.refs.sfcScriptForScriptLs.teleport.value;
				map.set(embeddedFile.fileName, sourceMap);
			}
			return map;
		}),
	};
	const dirs = computed(() => [...new Set(fileNames.value.map(path.dirname))]);

	return {
		getFileNames: untrack(() => fileNames.value),
		getDirs: untrack(() => dirs.value),
		getAll: untrack(() => all.value),
		raw: vueFiles,

		getTsTeleport: untrack((lsType: 'script' | 'template', fileName: string) => tsTeleports[lsType].value.get(fileName)),
		getEmbeddeds: untrack(function* (
			lsType: 'script' | 'template' | 'nonTs',
		) {
			for (const sourceMap of sourceMapsByFileNameAndLsType.value[lsType]) {
				yield sourceMap[1];
			}
		}),

		fromEmbeddedLocation: untrack(function* (
			lsType: 'script' | 'template' | 'nonTs',
			fileName: string,
			start: number,
			end?: number,
			filter?: (data: EmbeddedFileMappingData) => boolean,
			sourceMapFilter?: (sourceMap: EmbeddedFileSourceMap) => boolean,
		) {

			if (fileName.endsWith(`/${localTypes.typesFileName}`))
				return;

			if (end === undefined)
				end = start;

			const embedded = sourceMapsByFileNameAndLsType.value[lsType].get(fileName);

			if (embedded) {

				if (sourceMapFilter && !sourceMapFilter(embedded.sourceMap))
					return;

				for (const vueRange of embedded.sourceMap.getSourceRanges(start, end, filter)) {
					yield {
						fileName: embedded.file.fileName,
						range: vueRange[0],
						embedded,
						data: vueRange[1],
					};
				}
			}
			else {
				yield {
					fileName,
					range: {
						start,
						end,
					},
				};
			}
		}),
		fromEmbeddedFile: untrack(function (
			file: EmbeddedFile,
		) {
			return embeddedDocumentsMap.value.get(file);
		}),
		fromEmbeddedFileName: untrack(function (
			lsType: 'script' | 'template' | 'nonTs',
			fileName: string,
		) {
			return sourceMapsByFileNameAndLsType.value[lsType].get(fileName);
		}),
	};
}
