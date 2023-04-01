<script lang="tsx">
import { exactType } from 'vue-tsc/shared';
import Comp from './Comp.vue'
import GenericComp from './GenericComp.vue'

(<Comp>
	{{ activator: props => exactType(props.isActive, {} as boolean) }}
</Comp>);
(<GenericComp>
	{{ activator: props => exactType(props.isActive, {} as boolean) }}
</GenericComp>);
</script>

<script setup lang="tsx"></script>

<template>
	<Comp></Comp>
	<GenericComp></GenericComp>
</template>
