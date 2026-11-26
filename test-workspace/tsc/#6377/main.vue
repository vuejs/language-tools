<script setup lang="ts">
import Child from './child.vue';

const stream = new MediaStream();
const property = 'srcObject';
</script>

<template>
	<video :srcObject.prop="stream" :src.attr="'/video.mp4'" controls />
	<video .srcObject="stream" />
	<video :src-object.camel.prop="stream" />
	<video :[property].prop="stream" />
	<!-- @vue-expect-error -->
	<video :[property].prop="123" />
	<!-- @vue-expect-error -->
	<video :srcObject.prop="123" />
	<!-- @vue-expect-error -->
	<video :unknownProperty.prop="stream" />
	<!-- @vue-expect-error -->
	<video :srcObject.attr="stream" />
	<!-- @vue-expect-error -->
	<video :src="123" />
	<Child :srcObject.prop="'component prop'" />
	<!-- @vue-expect-error -->
	<Child :srcObject.prop="stream" />
	<a :text.prop="'video.mp4'" />
	<svg :tabIndex.prop="0">
		<!-- @vue-expect-error -->
		<a :text.prop="'video.mp4'" />
	</svg>
</template>
