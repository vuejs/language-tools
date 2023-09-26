<script setup lang="ts">
defineProps(['id']);
</script>

<script lang="ts">
import type { ProductResponse } from './api-response-type';
import { watchEffect } from 'vue';

export default {
	data(): { product?: ProductResponse } {
		return {
			product: undefined,
		};
	},

	methods: {
		async getData(id: string) {
			let fetchId = id;

			this.product = {
				id: fetchId,
			};
		},
	},

	created() {
		watchEffect(async () => {
			await this.getData(this.id);
		})
	},
};
</script>

<template>
	<div class="products-detail" v-if="!!product">
		<h1>{{ product.id }}</h1>
	</div>

	<div class="products-detail" v-if="!product">
		<p>maybe a loader?</p>
	</div>
</template>
