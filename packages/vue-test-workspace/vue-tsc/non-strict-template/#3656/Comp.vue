<script lang="ts" setup generic="T extends Column, K">
export interface Column {
	key: string;
	title: string;
	[key: string]: any;
}

interface Props {
	columns: T[];
	rows: K[];
}

defineProps<Props>();
</script>