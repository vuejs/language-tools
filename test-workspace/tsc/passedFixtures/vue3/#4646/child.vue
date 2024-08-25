<template>{{ msg }}</template>

<script lang="ts" setup>
import { exactType } from '../../shared';
import {PropType} from 'vue'

const msg = defineModel('msg', {
	type: String as PropType<string | null>,
	required: true,
})

exactType(msg.value, {} as string | null)
</script>
