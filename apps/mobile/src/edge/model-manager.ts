import * as FileSystem from "expo-file-system/legacy";
import { EDGE_MODELS } from "./model-registry";
import { OpenMuseEdge, type EdgeRuntimeStats } from "./native";
import type { EdgeAgentId } from "./types";

export type ModelInstallState =
  | "not-installed"
  | "checking"
  | "downloading"
  | "paused"
  | "installed"
  | "loading"
  | "loaded"
  | "error";

export type ModelManagerSnapshot = {
  modelId: EdgeAgentId;
  state: ModelInstallState;
  progress: number;
  bytesWritten: number;
  totalBytes: number;
  localUri?: string;
  error?: string;
  runtime: EdgeRuntimeStats;
  freeBytes?: number;
  totalDiskBytes?: number;
};

type PersistedModelMetadata = {
  modelId: EdgeAgentId;
  version: number;
  artifact: string;
  localUri: string;
  installedAt: string;
  expectedBytes?: number;
  sha256?: string | null;
};

type ResumeState = {
  modelId: EdgeAgentId;
  resumeData?: string;
};

const MODEL_ROOT = `${FileSystem.documentDirectory}openmuse-edge/models/`;
const META_ROOT = `${FileSystem.documentDirectory}openmuse-edge/meta/`;
const REQUIRED_HEADROOM_BYTES = 750 * 1024 * 1024;

const MODEL_DOWNLOADS: Record<EdgeAgentId, { repo: string; artifact: string; sha256?: string }> = {
  scout: {
    repo: "litert-community/Qwen3.5-0.8B",
    artifact: "Qwen3.5-0.8B_int8.litertlm",
  },
  muse: {
    repo: "litert-community/gemma-4-E2B-it-litert-lm",
    artifact: "gemma-4-E2B-it_Google_Tensor_G5.litertlm",
  },
  sage: {
    repo: "litert-community/Qwen3.5-4B",
    artifact: "Qwen3.5-4B_mixed_int4.litertlm",
  },
};

function downloadUrl(modelId: EdgeAgentId) {
  const item = MODEL_DOWNLOADS[modelId];
  return `https://huggingface.co/${item.repo}/resolve/main/${encodeURIComponent(item.artifact)}?download=true`;
}

function modelUri(modelId: EdgeAgentId) {
  return `${MODEL_ROOT}${MODEL_DOWNLOADS[modelId].artifact}`;
}

function metaUri(modelId: EdgeAgentId) {
  return `${META_ROOT}${modelId}.json`;
}

function resumeUri(modelId: EdgeAgentId) {
  return `${META_ROOT}${modelId}.resume.json`;
}

async function ensureDirectories() {
  await FileSystem.makeDirectoryAsync(MODEL_ROOT, { intermediates: true });
  await FileSystem.makeDirectoryAsync(META_ROOT, { intermediates: true });
}

async function readJson<T>(uri: string): Promise<T | null> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists) return null;
    return JSON.parse(await FileSystem.readAsStringAsync(uri)) as T;
  } catch {
    return null;
  }
}

async function writeJson(uri: string, value: unknown) {
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(value, null, 2));
}

class EdgeModelManager {
  private snapshots = new Map<EdgeAgentId, ModelManagerSnapshot>();
  private listeners = new Set<() => void>();
  private downloads = new Map<EdgeAgentId, FileSystem.DownloadResumable>();

  constructor() {
    for (const model of EDGE_MODELS) {
      this.snapshots.set(model.id, {
        modelId: model.id,
        state: "not-installed",
        progress: 0,
        bytesWritten: 0,
        totalBytes: Math.round(model.approximateSizeGb * 1024 ** 3),
        runtime: { available: OpenMuseEdge.isAvailable(), loaded: false },
      });
    }
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (modelId: EdgeAgentId) => {
    return this.snapshots.get(modelId)!;
  };

  private update(modelId: EdgeAgentId, patch: Partial<ModelManagerSnapshot>) {
    this.snapshots.set(modelId, { ...this.getSnapshot(modelId), ...patch });
    for (const listener of this.listeners) listener();
  }

  async refresh(modelId: EdgeAgentId) {
    this.update(modelId, { state: "checking", error: undefined });
    await ensureDirectories();

    const [info, freeBytes, totalDiskBytes, metadata] = await Promise.all([
      FileSystem.getInfoAsync(modelUri(modelId)),
      FileSystem.getFreeDiskStorageAsync(),
      FileSystem.getTotalDiskCapacityAsync(),
      readJson<PersistedModelMetadata>(metaUri(modelId)),
    ]);

    const runtime = OpenMuseEdge.getRuntimeStats();
    const installed = Boolean(info.exists && !info.isDirectory && metadata?.artifact === MODEL_DOWNLOADS[modelId].artifact);
    const loaded = installed && runtime.loaded && runtime.modelPath === modelUri(modelId);

    this.update(modelId, {
      state: loaded ? "loaded" : installed ? "installed" : "not-installed",
      localUri: installed ? modelUri(modelId) : undefined,
      progress: installed ? 1 : 0,
      bytesWritten: info.exists && !info.isDirectory ? info.size ?? 0 : 0,
      totalBytes:
        metadata?.expectedBytes ??
        (info.exists && !info.isDirectory && info.size ? info.size : this.getSnapshot(modelId).totalBytes),
      freeBytes,
      totalDiskBytes,
      runtime,
      error: undefined,
    });
  }

  async install(modelId: EdgeAgentId, authToken?: string) {
    await ensureDirectories();
    await this.refresh(modelId);

    const current = this.getSnapshot(modelId);
    if (current.state === "installed" || current.state === "loaded") return;

    const model = EDGE_MODELS.find((item) => item.id === modelId)!;
    const expected = Math.round(model.approximateSizeGb * 1024 ** 3);
    const freeBytes = await FileSystem.getFreeDiskStorageAsync();

    if (freeBytes < expected + REQUIRED_HEADROOM_BYTES) {
      throw new Error(
        `Not enough free storage. ${model.label} needs about ${model.approximateSizeGb.toFixed(
          1,
        )} GB plus 750 MB of working headroom.`,
      );
    }

    const resume = await readJson<ResumeState>(resumeUri(modelId));
    const headers: Record<string, string> | undefined = authToken
      ? { Authorization: `Bearer ${authToken}` }
      : undefined;

    const download = FileSystem.createDownloadResumable(
      downloadUrl(modelId),
      modelUri(modelId),
      { headers },
      ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
        const total = totalBytesExpectedToWrite > 0 ? totalBytesExpectedToWrite : expected;
        this.update(modelId, {
          state: "downloading",
          bytesWritten: totalBytesWritten,
          totalBytes: total,
          progress: total > 0 ? Math.min(1, totalBytesWritten / total) : 0,
          error: undefined,
        });
      },
      resume?.resumeData,
    );

    this.downloads.set(modelId, download);
    this.update(modelId, {
      state: "downloading",
      freeBytes,
      totalBytes: expected,
      error: undefined,
    });

    try {
      const result = await download.downloadAsync();
      if (!result) {
        this.update(modelId, { state: "paused" });
        return;
      }

      const info = await FileSystem.getInfoAsync(result.uri);
      const expectedSha = MODEL_DOWNLOADS[modelId].sha256;
      const actualSha = expectedSha ? await OpenMuseEdge.sha256File(result.uri) : null;

      if (expectedSha && (!actualSha || actualSha.toLowerCase() !== expectedSha.toLowerCase())) {
        await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => {});
        throw new Error("Downloaded model checksum did not match the catalog. The file was removed.");
      }

      const metadata: PersistedModelMetadata = {
        modelId,
        version: 1,
        artifact: MODEL_DOWNLOADS[modelId].artifact,
        localUri: result.uri,
        installedAt: new Date().toISOString(),
        expectedBytes: info.exists && !info.isDirectory ? info.size : undefined,
        sha256: actualSha,
      };

      await writeJson(metaUri(modelId), metadata);
      await FileSystem.deleteAsync(resumeUri(modelId), { idempotent: true }).catch(() => {});

      this.update(modelId, {
        state: "installed",
        localUri: result.uri,
        bytesWritten: info.exists && !info.isDirectory ? info.size ?? expected : expected,
        totalBytes: info.exists && !info.isDirectory ? info.size ?? expected : expected,
        progress: 1,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.update(modelId, { state: "error", error: message });
      throw error;
    } finally {
      this.downloads.delete(modelId);
    }
  }

  async pause(modelId: EdgeAgentId) {
    const download = this.downloads.get(modelId);
    if (!download) return;

    const pause = await download.pauseAsync();
    await writeJson(resumeUri(modelId), {
      modelId,
      resumeData: pause.resumeData,
    } satisfies ResumeState);

    this.update(modelId, { state: "paused" });
  }

  async resume(modelId: EdgeAgentId, authToken?: string) {
    return this.install(modelId, authToken);
  }

  async remove(modelId: EdgeAgentId) {
    const runtime = OpenMuseEdge.getRuntimeStats();
    if (runtime.loaded && runtime.modelPath === modelUri(modelId)) {
      await OpenMuseEdge.unloadModel();
    }

    await Promise.all([
      FileSystem.deleteAsync(modelUri(modelId), { idempotent: true }),
      FileSystem.deleteAsync(metaUri(modelId), { idempotent: true }),
      FileSystem.deleteAsync(resumeUri(modelId), { idempotent: true }),
    ]);

    this.update(modelId, {
      state: "not-installed",
      progress: 0,
      bytesWritten: 0,
      localUri: undefined,
      runtime: OpenMuseEdge.getRuntimeStats(),
      error: undefined,
    });
  }

  async load(modelId: EdgeAgentId, backend: "auto" | "npu" | "gpu" | "cpu" = "auto") {
    await this.refresh(modelId);
    const current = this.getSnapshot(modelId);
    if (!current.localUri) throw new Error("Install the model before loading it.");

    this.update(modelId, { state: "loading", error: undefined });

    try {
      const runtime = await OpenMuseEdge.loadModel(current.localUri, backend);
      this.update(modelId, { state: "loaded", runtime });
      return runtime;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.update(modelId, { state: "error", error: message });
      throw error;
    }
  }

  async unload(modelId: EdgeAgentId) {
    const runtime = await OpenMuseEdge.unloadModel();
    this.update(modelId, { state: "installed", runtime });
  }

  async test(prompt = "Reply with exactly: Local Muse is running.") {
    return OpenMuseEdge.generate(prompt);
  }
}

export const edgeModelManager = new EdgeModelManager();
