<template>
	<MyButton>ok</MyButton>
	<my-button>ok</my-button>
	<Foo.Bar />
	<component :is="comp" />
	<transition-group><keep-alive /></transition-group>
	<Teleport to="body" />
	<DIV />
	<clipPath />
	<clippath />
	<slot />
	<template v-if="ok" />
	<div>native</div>
	<MultiLine
		foo="bar"
	/>
</template>
