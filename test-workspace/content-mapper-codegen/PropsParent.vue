<script setup lang="ts">
import { useTemplateRef } from 'vue';
import PropsChild from './PropsChild.vue';
import PropsChild34 from './PropsChild34.vue';
import PropsGenericChild from './PropsGenericChild.vue';
import PropsOptions from './PropsOptions.vue';
import PropsRuntimeChild from './PropsRuntimeChild.vue';

const child = useTemplateRef<InstanceType<typeof PropsChild>>('child');
const exposed: number | undefined = child.value?.contributedExposed;
const genericChild = useTemplateRef('genericChild');
const genericExposed: number | undefined = genericChild.value?.contributedExposed;

function onNumber(value: number) {}
function onString(value: string) {}
</script>

<template>
	<PropsChild ref="child" own="a" :contributed="1" @contributed="onNumber" />
	<PropsChild :contributed="'wrong'" @contributed="onString" />
	<PropsGenericChild ref="genericChild" item="a" :contributed="1" @contributed="onNumber" />
	<PropsGenericChild item="a" :contributed="'wrong'" @contributed="onString" />
	<PropsChild34 own="a" :contributed="1" @contributed="onNumber" />
	<PropsChild34 :contributed="'wrong'" @contributed="onString" />
	<PropsOptions own="a" :contributed="1" />
	<PropsRuntimeChild own="a" :contributed="1" @contributed="onNumber" />
	<PropsRuntimeChild :contributed="'wrong'" @contributed="onString" />
</template>
