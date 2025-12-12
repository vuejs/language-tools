<!-- @fallthroughAttributes true -->

<script setup lang="ts">
import child from './child.vue';
import { exactType } from '../shared';
</script>

<template>
	<child @input="exactType($event, {} as Event)" />
</template>
