<script setup lang="ts">
import { exactType } from '../shared';

enum EnumA {
	Foo = 'foo',
	Bar = 'bar',
}

const enumKeyRecord: {
	[key in EnumA]: string;
} = {
	[EnumA.Foo]: 'a',
	[EnumA.Bar]: 'b',
};
</script>

<template>
	<template v-for="(value, key, index) of enumKeyRecord" :key>
		{{ exactType(value, {} as string) }}
		{{ exactType(key, {} as EnumA) }}
		{{ exactType(index, {} as number) }}
	</template>
</template>
