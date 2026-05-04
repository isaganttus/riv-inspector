import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

// Polyfill minimal browser globals needed by the Rive WASM module
if (typeof globalThis.document === "undefined") {
  Object.assign(globalThis, {
    document: {
      createElement: () => ({
        getContext: () => null,
        width: 0,
        height: 0,
      }),
    },
  });
}
if (typeof globalThis.window === "undefined") {
  Object.assign(globalThis, { window: globalThis });
}
if (typeof globalThis.navigator === "undefined") {
  Object.assign(globalThis, { navigator: { userAgent: "node" } });
}
if (typeof globalThis.Image === "undefined") {
  Object.assign(globalThis, {
    Image: class Image {
      _src = "";
      width = 1;
      height = 1;
      naturalWidth = 1;
      naturalHeight = 1;
      complete = true;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      get src() {
        return this._src;
      }
      set src(val: string) {
        this._src = val;
        // Fire onload async to simulate browser behavior
        if (this.onload) setTimeout(() => this.onload?.(), 0);
      }

      decode() {
        return Promise.resolve();
      }
      addEventListener(event: string, cb: () => void) {
        if (event === "load") setTimeout(() => cb(), 0);
      }
      removeEventListener() {}
    },
  });
}

interface RiveRuntime {
  CustomFileAssetLoader: new (callbacks: {
    loadContents(asset: RiveAsset, bytes: Uint8Array): boolean;
  }) => unknown;
  load(
    bytes: Uint8Array,
    assetLoader: unknown,
    autoplay: boolean,
  ): Promise<RiveFile>;
  cleanup(): void;
}

type RiveRuntimeFactory = (options: {
  locateFile(file: string): string;
  wasmBinary: ArrayBuffer;
}) => Promise<RiveRuntime>;

interface RiveAsset {
  name?: string;
  fileExtension?: string;
  isImage?: boolean;
  isFont?: boolean;
  isAudio?: boolean;
}

interface RiveFile {
  artboardCount(): number;
  artboardByIndex(index: number): RiveArtboard;
  enums(): Iterable<RiveDataEnum>;
  viewModelCount(): number;
  viewModelByIndex(index: number): RiveViewModel;
  unref?(): void;
}

interface RiveArtboard {
  name: string;
  frameOrigin: boolean;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  width: number;
  height: number;
  stateMachineCount(): number;
  stateMachineByIndex(index: number): RiveStateMachine;
  delete?(): void;
}

interface RiveStateMachine {
  name?: string;
  delete?(): void;
}

interface RiveDataEnum {
  name: string;
  values: Iterable<string>;
}

interface RiveViewModel {
  name: string;
  getProperties(): RiveProperty[];
  getInstanceNames(): Iterable<string>;
  defaultInstance(): RiveViewModelInstance | null | undefined;
}

interface RiveProperty {
  name: string;
  type: string;
}

interface RiveViewModelInstance {
  enum(name: string): RiveEnumInstance | null | undefined;
  delete?(): void;
}

interface RiveEnumInstance {
  values?: Iterable<string>;
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

export type {
  ArtboardMeta,
  AssetsMeta,
  EnumMeta,
  PropertyMeta,
  RivMetadata,
  ViewModelMeta,
};

export interface InspectorSession {
  inspect(rivFilePath: string): Promise<RivMetadata>;
  close(): void;
}

async function withSuppressedWasmLogs<T>(fn: () => Promise<T>): Promise<T> {
  const originalErr = console.error;
  const originalWarn = console.warn;
  const originalLog = console.log;

  const isWasmNoise = (args: unknown[]) => {
    const msg = args.join(" ");
    return (
      msg.includes("No WebGL") ||
      msg.includes("Aborted") ||
      msg.includes("SyncState") ||
      msg.includes("Image mesh")
    );
  };

  try {
    console.error = (...args: unknown[]) => {
      if (!isWasmNoise(args)) originalErr(...args);
    };
    console.warn = (...args: unknown[]) => {
      if (!isWasmNoise(args)) originalWarn(...args);
    };
    console.log = (...args: unknown[]) => {
      if (!isWasmNoise(args)) originalLog(...args);
    };
    return await fn();
  } finally {
    console.error = originalErr;
    console.warn = originalWarn;
    console.log = originalLog;
  }
}

async function loadRiveRuntime(): Promise<{
  rive: RiveRuntime;
  close(): void;
}> {
  // Load the WASM runtime
  const require = createRequire(import.meta.url);
  const canvasAdvancedPath = require.resolve("@rive-app/canvas-advanced");
  const wasmDir = dirname(canvasAdvancedPath);
  const wasmPath = resolve(wasmDir, "rive.wasm");

  // Dynamic import of the ESM module
  const RiveModule = await import("@rive-app/canvas-advanced");
  const RiveCanvas = RiveModule.default as unknown as RiveRuntimeFactory;

  // Read WASM binary directly (avoids fetch() issues in Node.js)
  const wasmBinary = readFileSync(wasmPath);
  const wasmBinaryBuffer = wasmBinary.buffer.slice(
    wasmBinary.byteOffset,
    wasmBinary.byteOffset + wasmBinary.byteLength,
  );

  const rive = await RiveCanvas({
    locateFile: (_file: string) => wasmPath,
    wasmBinary: wasmBinaryBuffer,
  });

  let closed = false;
  return {
    rive,
    close() {
      if (closed) return;
      closed = true;
      try {
        rive.cleanup();
      } catch {}
    },
  };
}

async function inspectWithRuntime(
  rive: RiveRuntime,
  rivFilePath: string,
): Promise<RivMetadata> {
  // Read the .riv file
  const buffer = readFileSync(rivFilePath);
  const bytes = new Uint8Array(buffer);

  // Track assets via the asset loader callback
  const assets: AssetsMeta = { images: [], fonts: [], audio: [] };

  const assetLoader = new rive.CustomFileAssetLoader({
    loadContents: (asset: RiveAsset, _bytes: Uint8Array) => {
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
  let file: RiveFile | undefined;

  try {
    file = await rive.load(bytes, assetLoader, false);

    // Extract artboards
    const artboards: ArtboardMeta[] = [];
    const artboardCount = file.artboardCount();

    for (let i = 0; i < artboardCount; i++) {
      let artboard: RiveArtboard;
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
            stateMachines.push(sm.name ?? `StateMachine_${j}`);
            sm.delete?.();
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
        // Disable frameOrigin so bounds reflects the actual origin offset.
        // The WASM runtime defaults frameOrigin to true regardless of the file,
        // which forces minX/minY to 0 and hides the real origin position.
        artboard.frameOrigin = false;
        // bounds gives AABB: { minX, minY, maxX, maxY }
        const bounds = artboard.bounds;
        width = Math.round(bounds.maxX - bounds.minX);
        height = Math.round(bounds.maxY - bounds.minY);
        // Origin as a normalized value (0.0-1.0), where 0.5 = centered
        originX =
          width > 0 ? Math.round((-bounds.minX / width) * 100) / 100 : 0;
        originY =
          height > 0 ? Math.round((-bounds.minY / height) * 100) / 100 : 0;
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

      try {
        artboard.delete?.();
      } catch {}
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

      const properties: PropertyMeta[] = props.map((p) => {
        const prop: PropertyMeta = { name: p.name, type: p.type };

        // If it's an enum type, try to find the enum name
        if (p.type === "enumType" || p.type === "enum") {
          prop.type = "enum";
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
                      (e) =>
                        JSON.stringify(e.values) ===
                        JSON.stringify([...enumValues]),
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
          defaultInstance.delete?.();
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

    return {
      file: rivFilePath.split(/[/\\]/).pop() || rivFilePath,
      fileId: null, // File ID is in the binary header but not exposed via the WASM API
      format: "", // Version info also not directly exposed
      artboards,
      viewModels,
      enums: enumsMeta,
      assets: {
        images: [...new Set(assets.images)],
        fonts: [...new Set(assets.fonts)],
        audio: [...new Set(assets.audio)],
      },
    };
  } finally {
    try {
      file?.unref?.();
    } catch {}
  }
}

export async function createInspector(): Promise<InspectorSession> {
  const runtime = await withSuppressedWasmLogs(loadRiveRuntime);

  return {
    inspect(rivFilePath: string) {
      return withSuppressedWasmLogs(() =>
        inspectWithRuntime(runtime.rive, rivFilePath),
      );
    },
    close() {
      runtime.close();
    },
  };
}

export async function inspect(rivFilePath: string): Promise<RivMetadata> {
  const inspector = await createInspector();
  try {
    return await inspector.inspect(rivFilePath);
  } finally {
    inspector.close();
  }
}
