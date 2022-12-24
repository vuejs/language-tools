import * as SourceMaps from '@volar/source-map';
import { TeleportCapabilities, TeleportMappingData } from './types';

export class Teleport extends SourceMaps.SourceMapBase<TeleportMappingData> {
	*findTeleports(start: number, filter?: (data: TeleportCapabilities) => boolean) {
		for (const mapped of this.toGeneratedOffsets(start)) {
			if (!filter || filter(mapped[1].data.toSourceCapabilities)) {
				yield mapped[0];
			}
		}
		for (const mapped of this.toSourceOffsets(start)) {
			if (!filter || filter(mapped[1].data.toGeneratedCapabilities)) {
				yield mapped[0];
			}
		}
	}
}
