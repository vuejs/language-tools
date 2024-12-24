<script setup lang="ts">
import { exactType } from '../../shared';
</script>

<script lang="ts">
import { Slot, SlotsType } from 'vue';

export default {
	slots: Object as SlotsType<{ foo?: {} }>
};
</script>

<template>
	{{ exactType($slots.foo, {} as Slot<{} | undefined> | undefined) }}
</template>
