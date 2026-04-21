import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Polyfill minimal browser globals needed by the Rive WASM module
if (typeof globalThis.document === "undefined") {
  (globalThis as any).document = {
    createElement: () => ({
      getContext: () => null,
      width: 0,
      height: 0,
    }),
  };
}
if (typeof globalThis.window === "undefined") {
  (globalThis as any).window = globalThis;
}
if (typeof globalThis.navigator === "undefined") {
  (globalThis as any).navigator = { userAgent: "node" };
}
if (typeof globalThis.Image === "undefined") {
  (globalThis as any).Image = class Image {
    _src = "";
    width = 1;
    height = 1;
    naturalWidth = 1;
    naturalHeight = 1;
    complete = true;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;

    get src() { return this._src; }
    set src(val: string) {
      this._src = val;
      // Fire onload async to simulate browser behavior
      if (this.onload) setTimeout(() => this.onload?.(), 0);
    }

    decode() { return Promise.resolve(); }
    addEventListener(_event: string, cb: Function) {
      if (_event === "load") setTimeout(() => cb(), 0);
    }
    removeEventListener() {}
  };
}

// Types matching @rive-app/canvas-advanced
interface RivMetadata {
  file: string;
  fileId: number | null;
  format: string;
  artboards: ArtboardMeta[];
  viewModels: ViewModelMeta[];
  enums: EnumMeta[];
  assets: AssetsMeta;
}

interface ArtboardMeta {
  name: string;
  size: [number, number];
  origin: [number, number];
  stateMachines: string[];
}

interface ViewModelMeta {
  name: string;
  properties: PropertyMeta[];
  instances: string[];
}

interface PropertyMeta {
  name: string;
  type: string;
  enum?: string;
}

interface EnumMeta {
  name: string;
  values: string[];
}

interface AssetsMeta {
  images: string[];
  fonts: string[];
  audio: string[];
}

export type { RivMetadata, ArtboardMeta, ViewModelMeta, PropertyMeta, EnumMeta, AssetsMeta };

export async function inspect(rivFilePath: string): Promise<RivMetadata> {
  // Suppress noisy WASM warnings (No WebGL support, Aborted, SyncState, etc.)
  const originalErr = console.error;
  const originalWarn = console.warn;
  const originalLog = console.log;
  const suppress = (...args: any[]) => {
    const msg = args.join(" ");
    if (
      msg.includes("No WebGL") ||
      msg.includes("Aborted") ||
      msg.includes("SyncState") ||
      msg.includes("Image mesh")
    ) return;
    originalErr(...args);
  };
  console.error = suppress;
  console.warn = suppress;
  // Also suppress console.log for WASM noise
  const suppressLog = (...args: any[]) => {
    const msg = args.join(" ");
    if (
      msg.includes("No WebGL") ||
      msg.includes("Aborted") ||
      msg.includes("SyncState") ||
      msg.includes("Image mesh")
    ) return;
    originalLog(...args);
  };
  console.log = suppressLog;

  try {
  // Load the WASM runtime
  const require = createRequire(import.meta.url);
  const canvasAdvancedPath = require.resolve("@rive-app/canvas-advanced");
  const wasmDir = dirname(canvasAdvancedPath);
  const wasmPath = resolve(wasmDir, "rive.wasm");

  // Dynamic import of the ESM module
  const RiveModule = await import("@rive-app/canvas-advanced");
  const RiveCanvas = RiveModule.default;

  // Read WASM binary directly (avoids fetch() issues in Node.js)
  const wasmBinary = readFileSync(wasmPath);

  const rive = await (RiveCanvas as any)({
    locateFile: (_file: string) => wasmPath,
    wasmBinary: wasmBinary.buffer,
  });

  // Read the .riv file
  const buffer = readFileSync(rivFilePath);
  const bytes = new Uint8Array(buffer);

  // Track assets via the asset loader callback
  const assets: AssetsMeta = { images: [], fonts: [], audio: [] };

  const assetLoader = new rive.CustomFileAssetLoader({
    loadContents: (asset: any, _bytes: any) => {
      const name = asset.name || "unnamed";
      const ext = asset.fileExtension || "";
      const filename = ext ? `${name}.${ext}` : name;

      if (asset.isImage) assets.images.push(filename);
      else if (asset.isFont) assets.fonts.push(filename);
      else if (asset.isAudio) assets.audio.push(filename);

      // Return false to let the runtime handle the asset (we just want the metadata)
      return false;
    },
  });

  // Load the file
  const file = await rive.load(bytes, assetLoader, false);

  // Extract artboards
  const artboards: ArtboardMeta[] = [];
  const artboardCount = file.artboardCount();

  for (let i = 0; i < artboardCount; i++) {
    let artboard: any;
    try {
      artboard = file.artboardByIndex(i);
    } catch {
      continue;
    }

    const stateMachines: string[] = [];
    try {
      const smCount = artboard.stateMachineCount();
      for (let j = 0; j < smCount; j++) {
        try {
          const sm = artboard.stateMachineByIndex(j);
          stateMachines.push((sm as any).name ?? `StateMachine_${j}`);
          (sm as any).delete?.();
        } catch {
          stateMachines.push(`StateMachine_${j}`);
        }
      }
    } catch {
      // stateMachineCount failed
    }

    // Try multiple ways to get artboard dimensions and origin
    let width = 0;
    let height = 0;
    let originX = 0;
    let originY = 0;
    try {
      // bounds gives AABB: { minX, minY, maxX, maxY }
      const bounds = artboard.bounds;
      width = Math.round(bounds.maxX - bounds.minX);
      height = Math.round(bounds.maxY - bounds.minY);
      // Origin is where (0,0) sits within the artboard frame (from top-left)
      originX = Math.round(-bounds.minX);
      originY = Math.round(-bounds.minY);
    } catch {
      try {
        width = Math.round(artboard.width);
        height = Math.round(artboard.height);
      } catch {}
    }

    artboards.push({
      name: artboard.name,
      size: [width, height],
      origin: [originX, originY],
      stateMachines,
    });

    try { artboard.delete(); } catch {}
  }

  // Extract enums (need this before view models so we can reference enum names)
  const fileEnums = file.enums();
  const enumsMeta: EnumMeta[] = [];

  for (const dataEnum of fileEnums) {
    enumsMeta.push({
      name: dataEnum.name,
      values: [...dataEnum.values],
    });
  }

  // Extract view models
  const viewModels: ViewModelMeta[] = [];
  const vmCount = file.viewModelCount();

  for (let i = 0; i < vmCount; i++) {
    const vm = file.viewModelByIndex(i);
    const props = vm.getProperties();

    const properties: PropertyMeta[] = props.map((p: any) => {
      const prop: PropertyMeta = { name: p.name, type: p.type };

      // If it's an enum type, try to find the enum name
      if (p.type === "enumType" || p.type === "enum") {
        prop.type = "enum";
        // We'll try to resolve the enum name by checking instances
        // For now, mark it as enum — the enum name resolution happens below
      }

      return prop;
    });

    // Get instance names
    const instanceNames = vm.getInstanceNames();

    // Try to resolve enum property names by inspecting a default instance
    try {
      const defaultInstance = vm.defaultInstance();
      if (defaultInstance) {
        for (const prop of properties) {
          if (prop.type === "enum") {
            try {
              const enumInstance = defaultInstance.enum(prop.name);
              if (enumInstance) {
                // Find matching enum by checking values
                const enumValues = enumInstance.values;
                if (enumValues) {
                  const matchingEnum = enumsMeta.find(
                    (e) => JSON.stringify(e.values) === JSON.stringify([...enumValues])
                  );
                  if (matchingEnum) {
                    prop.enum = matchingEnum.name;
                  }
                }
              }
            } catch {
              // Property might not be accessible on default instance
            }
          }
        }
        defaultInstance.delete();
      }
    } catch {
      // No default instance available
    }

    viewModels.push({
      name: vm.name,
      properties,
      instances: [...instanceNames],
    });
  }

  // Build result
  const result: RivMetadata = {
    file: rivFilePath.split(/[/\\]/).pop() || rivFilePath,
    fileId: null, // File ID is in the binary header but not exposed via the WASM API
    format: "", // Version info also not directly exposed
    artboards,
    viewModels,
    enums: enumsMeta,
    assets,
  };

  // Cleanup — wrap in try/catch since WASM cleanup can fail in headless Node
  try { file.unref(); } catch {}
  try { rive.cleanup(); } catch {}

  return result;
  } finally {
    // Always restore console, even if an error is thrown during parsing
    console.error = originalErr;
    console.warn = originalWarn;
    console.log = originalLog;
  }
}
