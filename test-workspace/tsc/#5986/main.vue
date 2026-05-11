<script setup lang="ts">
import { exactType } from "../shared";

class CustomArray extends Array<string> {
	override push(...items: (string | number)[]) {
		return super.push(...items.map((item) => String(item)));
	}
}

const customArray = new CustomArray();
</script>

<template>
	<div v-for="item in customArray">
		{{ exactType(item, {} as string) }}
	</div>
</template>
