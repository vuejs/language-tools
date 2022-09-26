import * as SourceMaps from '@volar/source-map';
import { PositionCapabilities, TeleportMappingData, TeleportCapabilities } from './types';

export class EmbeddedFileSourceMap extends SourceMaps.SourceMapBase<PositionCapabilities> { }

export class Teleport extends SourceMaps.SourceMapBase<TeleportMappingData> {
	*findTeleports(start: number, end?: number, filter?: (data: TeleportCapabilities) => boolean) {
		for (const [teleRange, data] of this.getMappedRanges(start, end, filter ? data => filter(data.toGenedCapabilities) : undefined)) {
			yield [teleRange, data.toGenedCapabilities] as const;
		}
		for (const [teleRange, data] of this.getSourceRanges(start, end, filter ? data => filter(data.toGenedCapabilities) : undefined)) {
			yield [teleRange, data.toGenedCapabilities] as const;
		}
	}
}
