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
	<template v-for="(row, rowIndex, index) of enumKeyRecord" :key="rowIndex">
		{{ exactType(row, {} as string) }}
		{{ exactType(rowIndex, {} as EnumA) }}
		{{ exactType(index, {} as number) }}
	</template>
</template>
