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

<template>
	<table>
		<thead>
			<tr>
				<th v-for="(col, index) in columns" :key="index">
					<slot :name="`col(${col.key})`" v-bind="col">
						<template v-if="col.title">{{ col.title }}</template>
					</slot>
				</th>
			</tr>
		</thead>

		<tbody>
			<tr v-for="(row, rowIndex) in rows" :key="rowIndex">
				<td v-for="(item, key) in row" :key="`${row}${key.toString()}`">
					<slot :name="`row(${key.toString()})`" v-bind="row">
						{{ item }}
					</slot>
				</td>
			</tr>
		</tbody>
	</table>
</template>
