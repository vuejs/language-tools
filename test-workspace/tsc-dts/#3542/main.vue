<script setup lang="ts">
type Emits = {
	(e: 'a1', value: number): void;
	(e: 'a2', value: number): void;
	(e: 'a3', value: number): void;
	(e: 'a4', value: number): void;
	(e: 'a5', value: number): void;
	(e: 'a6', value: number): void;
	(e: 'a7', value: number): void;
	(e: 'a8', value: number): void;
	(e: 'a9', value: number): void;
	(e: 'a10', value: number): void;
};

defineEmits<Emits>();
</script>
