<script setup lang="ts" generic="T extends keyof HTMLElementTagNameMap = 'h1'">
defineProps<
	Partial<HTMLElementTagNameMap[T]> & {
		as?: T;
	}
>();
</script>