# Rive metadata reference

What can be read from a `.riv` file via the `@rive-app/canvas-advanced` WASM runtime.

---

## Currently extracted by riv-inspect

### Artboard

| Field | Source | Notes |
|---|---|---|
| `name` | `artboard.name` | |
| `size` | `artboard.bounds` → `maxX - minX`, `maxY - minY` | In pixels |
| `origin` | `artboard.bounds` → `-minX`, `-minY` | Position of (0,0) anchor within the artboard frame |
| `stateMachines` | `artboard.stateMachineByIndex(i).name` | Names of all state machines |

### View Model

| Field | Source | Notes |
|---|---|---|
| `name` | `vm.name` | |
| `properties` | `vm.getProperties()` | Each has `name` and `type` (see DataType below) |
| `enum` (on property) | Resolved via `defaultInstance().enum(prop.name).values` | Only set when type is `enum` |
| `instances` | `vm.getInstanceNames()` | Named instances defined in the file |

### DataType values (property types)

`none` · `string` · `number` · `boolean` · `color` · `list` · `enumType` · `trigger` · `viewModel` · `integer` · `listIndex` · `image` · `artboard`

### Data Enum

| Field | Source |
|---|---|
| `name` | `dataEnum.name` |
| `values` | `dataEnum.values` |

### Assets

Collected via `CustomFileAssetLoader` as the file loads. Each asset fires the callback once.

| Field | Source | Notes |
|---|---|---|
| `images` | `asset.name + "." + asset.fileExtension` where `asset.isImage` | |
| `fonts` | `asset.name + "." + asset.fileExtension` where `asset.isFont` | |
| `audio` | `asset.name + "." + asset.fileExtension` where `asset.isAudio` | |

---

## Accessible but not yet extracted

These fields are available in the WASM API and could be added to riv-inspect.

### Artboard — additional fields

| Field | Source | Notes |
|---|---|---|
| `frameOrigin` | `artboard.frameOrigin` | `boolean` — `true` means origin is pinned to top-left (the Rive default) |
| `hasAudio` | `artboard.hasAudio` | `boolean` |
| `animations` | `artboard.animationByIndex(i)` loop | List of linear animation names on this artboard |

### Linear Animation (per artboard)

Accessed via `artboard.animationByIndex(i)` — requires looping up to `artboard.animationCount()`.

| Field | Source | Notes |
|---|---|---|
| `name` | `animation.name` | |
| `loopValue` | `animation.loopValue` | `0` = one-shot, `1` = loop, `2` = ping-pong |

### State Machine Inputs (per state machine)

Accessing inputs requires instantiating a `StateMachineInstance` (not just a `StateMachine` reference). Needs `artboard.advance(0)` first to settle the artboard.

| Field | Source | Notes |
|---|---|---|
| `name` | `smInstance.input(i).name` | |
| `type` | `smInstance.input(i).type` | `0` = bool, `1` = number, `2` = trigger |

### Assets — additional fields

The `FileAsset` object in the loader callback also exposes:

| Field | Source | Notes |
|---|---|---|
| `uniqueFilename` | `asset.uniqueFilename` | Rive-internal unique name including a hash |
| `cdnUuid` | `asset.cdnUuid` | UUID used to fetch the asset from the Rive CDN (empty if not a CDN asset) |

### File-level

| Field | Source | Notes |
|---|---|---|
| `hasAudio` | `file.hasAudio` | `boolean` — true if any asset in the file is audio |

---

## Not accessible via the WASM JS API

These pieces of data exist in the `.riv` binary but are not surfaced by the runtime.

| Field | Why |
|---|---|
| File ID / version | Stored in the binary header; not exposed by the WASM module |
| Nested artboard hierarchy (groups, shapes, paths) | Runtime does not enumerate scene graph nodes — you can fetch a named node via `artboard.node(name)` but there is no "list all nodes" API |
| Event definitions | Events fire at runtime via `StateMachineInstance.reportedEventAt(i)` — there is no static list of all events defined in the file |
| Listener definitions | Configured inside state machines; not enumerable without advancing |
| Constraint definitions | Not exposed |
| Timeline keyframe data | Not exposed via JS; only the animation name and loop type are readable |
| Artboard background color | Not exposed |
| Layer/blend mode per shape | Not exposed at the metadata level |
