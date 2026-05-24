<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ toggleEnter: boolean }>();

const eventName = computed(() => (props.toggleEnter ? 'enter' : null));

function handleEvent() {
    // noop
}
</script>

<template>
    <Transition @[eventName]="handleEvent" />
</template>
