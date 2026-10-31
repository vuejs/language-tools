<script setup lang="ts">
import { exactType } from '../shared';
import Destructure from './destructure.vue';
import DestructureRuntime from './destructure-runtime.vue';
import Js from './js.vue';
import Model from './model.vue';
import ModelRuntimeProps from './model-runtime-props.vue';
import WithDefaults from './with-defaults.vue';

// the runtime applies a default, so the instance gives the prop without `undefined`
exactType({} as InstanceType<typeof WithDefaults>['a'], {} as number);
exactType({} as InstanceType<typeof WithDefaults>['b'], {} as number[]);
exactType({} as InstanceType<typeof WithDefaults>['d'], {} as number | undefined);
exactType({} as InstanceType<typeof Destructure>['a'], {} as number);
exactType({} as InstanceType<typeof Destructure>['foo-bar'], {} as string);
exactType({} as InstanceType<typeof Destructure>['c'], {} as number[]);
exactType({} as InstanceType<typeof Destructure>['d'], {} as number | undefined);
exactType({} as InstanceType<typeof DestructureRuntime>['a'], {} as number);
exactType({} as InstanceType<typeof DestructureRuntime>['d'], {} as number | undefined);
exactType({} as InstanceType<typeof Model>['modelValue'], {} as number);
exactType({} as InstanceType<typeof Model>['fooBar'], {} as string);
exactType({} as InstanceType<typeof Model>['o'], {} as number | undefined);
exactType({} as InstanceType<typeof ModelRuntimeProps>['a'], {} as number | undefined);
exactType({} as InstanceType<typeof ModelRuntimeProps>['modelValue'], {} as number);
exactType({} as InstanceType<typeof ModelRuntimeProps>['o'], {} as number | undefined);
exactType({} as InstanceType<typeof Js>['a'], {} as number);
exactType({} as InstanceType<typeof Js>['d'], {} as number | undefined);
exactType({} as InstanceType<typeof Js>['modelValue'], {} as number);
</script>

<template>
	<!-- a default does not make a prop required for the parent -->
	<WithDefaults />
	<Destructure />
	<DestructureRuntime />
	<Model />
	<ModelRuntimeProps />
	<Js />
</template>
