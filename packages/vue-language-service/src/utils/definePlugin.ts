import { Embedded, EmbeddedDocumentSourceMap } from '@volar/vue-typescript';

export async function visitEmbedded(embeddeds: Embedded[], cb: (sourceMap: EmbeddedDocumentSourceMap) => Promise<boolean>) {
    for (const embedded of embeddeds) {

        if (!await visitEmbedded(embedded.embeddeds, cb)) {
            return false;
        }

        if (embedded.sourceMap) {
            if (!await cb(embedded.sourceMap)) {
                return false;
            }
        }
    }

    return true;
}
