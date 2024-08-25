<template>
	<Transition @after-leave="el => exactType(el, {} as Element)"></Transition>
	<Transition :on-after-leave="el => exactType(el, {} as Element)"></Transition>
</template>

<script setup lang="ts">
import { exactType } from '../../shared';
</script>
