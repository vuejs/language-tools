import * as SourceMaps from '@volar/source-map';
import { PositionCapabilities, TeleportMappingData } from './types';

export class EmbeddedFileSourceMap extends SourceMaps.SourceMapBase<PositionCapabilities> { }

export class Teleport extends SourceMaps.SourceMapBase<TeleportMappingData> {
	*findTeleports(start: number) {
		for (const mapped of this.toGeneratedOffsets(start)) {
			yield [mapped[0], mapped[1].data.toSourceCapabilities] as const;
		}
		for (const mapped of this.toSourceOffsets(start)) {
			yield [mapped[0], mapped[1].data.toGenedCapabilities] as const;
		}
	}
}
