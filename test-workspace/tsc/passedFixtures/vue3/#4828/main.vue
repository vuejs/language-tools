<script setup lang="ts">
import { exactType } from 'tsc/passedFixtures/shared';
import { useTemplateRef } from 'vue';

const ref1 = useTemplateRef('input');
const ref2 = useTemplateRef( 'input');

exactType(ref1.value!, {} as HTMLInputElement);
exactType(ref2.value!, {} as HTMLInputElement);
</script>

<template>
	<input ref="input">
</template>
