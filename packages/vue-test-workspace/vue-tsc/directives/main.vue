<script setup lang="ts">
import { FunctionDirective } from 'vue';
import { exactType } from '../shared';

let Foo: (_: { foo?: string }) => void;

let vFoo: FunctionDirective<typeof Foo, (_: number) => void>;
</script>

<template>
	<Foo v-foo="v => exactType(v, {} as number)"></Foo>
</template>
