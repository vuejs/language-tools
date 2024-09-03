<script lang="ts" setup>
import { useTemplateRef } from 'vue';
import { exactType } from '../../shared';

const audioEl = useTemplateRef('audio');
if (audioEl.value) {
	exactType(audioEl.value, {} as HTMLAudioElement);
}

const imgEl = useTemplateRef('img');
if (imgEl.value) {
	exactType(imgEl.value, {} as HTMLImageElement);
}

const svgEl = useTemplateRef('svg');
if (svgEl.value) {
	exactType(svgEl.value, {} as SVGSVGElement);
}

const feImageEl = useTemplateRef('feImage');
if (feImageEl.value) {
	exactType(feImageEl.value, {} as SVGFEImageElement);
}

const aEl = useTemplateRef('a');
if (aEl.value) {
	exactType(aEl.value, {} as HTMLAnchorElement);
}
</script>

<template>
	<audio ref="audio"></audio>
	<img ref="img" />
	<svg ref="svg">
		<feImage ref="feImage"></feImage>
	</svg>
	<a ref="a"></a>
</template>
