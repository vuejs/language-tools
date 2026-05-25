<template>
	<slot name="no-bind"></slot>
	<slot :num="123"></slot>
	<slot name="named-slot" str="str"></slot>
	<slot name="vbind" v-bind="{ num: 123, str: 'str' }"></slot>
	<template v-for="key in ['str', 123]" :key="key">
		<slot :name="`loop-${key}`" v-bind="{str: 'str', key}"></slot>
	</template>
</template>
