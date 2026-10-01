# vendor

`dice-box-threejs.es.js` — [@3d-dice/dice-box-threejs](https://github.com/3d-dice/dice-box-threejs)
v0.0.12, MIT, vendored rather than fetched from a CDN because the published
page may only load scripts from its own origin.

The published build has **three.js and cannon-es bundled in**, so this one file
is the whole dependency: no imports, no wasm, no web worker, and — with sounds
off and no texture theme — nothing fetched at runtime. That is what makes it
usable inside a sandboxed page at all.

It is used for one thing: playing a throw whose result has already been
decided. The engine rolls the dice; the physics is told what to land on, via
this project's own predetermined-roll notation (`2d6@4,5`). Nothing about the
game's randomness, seeding or co-op lockstep goes through it.

Update by re-running `npm pack @3d-dice/dice-box-threejs` and copying
`package/dist/dice-box-threejs.es.js` here.
