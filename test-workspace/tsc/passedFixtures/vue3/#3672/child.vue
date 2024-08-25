<script setup lang="ts" generic="T extends string | number">
interface InputProps {
	type?: 'input';
	value: (k: T) => void;
	typeDefinition: T;
}

interface SelectProps {
	type: 'select';
	value: (k: T[]) => void;
	typeDefinition: T;
}

defineProps<InputProps | SelectProps>()
</script>
