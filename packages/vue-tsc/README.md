# vue-tsc

`vue-tsc --noEmit && vite build`

Vue 3 command line Type-Checking tool base on IDE plugin [Volar](https://github.com/johnsoncodehk/volar).

Roadmap:

- [x] Type-Checking with `--noEmit`
- [x] Use released LSP module
- [x] Make `typescript` as peerDependencies
- [x] Cleaner dependencies (remove `prettyhtml`, `prettier` etc.) (with `vscode-vue-languageservice` version >= 0.26.4)
- [x] dts emit support
- [ ] Watch mode support

## Using

Type check:

`vue-tsc --noEmit`

Build dts:

`vue-tsc --declaration --emitDeclarationOnly`

Check out https://github.com/johnsoncodehk/volar/discussions/640#discussioncomment-1555479 for example repo.

## Sponsors

This company is [sponsoring this project](https://github.com/sponsors/johnsoncodehk) to improve your DX. 💪

<a href="https://github.com/Leniolabs">
  <img itemprop="image" src="https://github.com/Leniolabs.png" width="100" height="100">
</a>
