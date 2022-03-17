import * as SourceMaps from '@volar/source-map';
import { EmbeddedFileMappingData, TeleportMappingData, TeleportSideData } from '@volar/vue-code-gen/out/types';

export class EmbeddedFileSourceMap extends SourceMaps.SourceMapBase<EmbeddedFileMappingData> { }

export class Teleport extends SourceMaps.SourceMapBase<TeleportMappingData> {
	*findTeleports(start: number, end?: number, filter?: (data: TeleportSideData) => boolean) {
		for (const [teleRange, data] of this.getMappedRanges(start, end, filter ? data => filter(data.toTarget) : undefined)) {
			yield [teleRange, data.toTarget] as const;
		}
		for (const [teleRange, data] of this.getSourceRanges(start, end, filter ? data => filter(data.toTarget) : undefined)) {
			yield [teleRange, data.toTarget] as const;
		}
	}
}
