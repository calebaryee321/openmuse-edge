import { NativeModule, requireNativeModule } from "expo";

export type EdgeRuntimeStats = {
  available: boolean;
  loaded: boolean;
  modelPath?: string | null;
  backend?: "npu" | "gpu" | "cpu" | null;
};

export type EdgeTokenEvent = { text: string };
export type EdgeErrorEvent = { message: string };

export type EdgeNotificationEvent = {
  id: string;
  packageName: string;
  postedAt: number;
  title?: string | null;
  text?: string | null;
  subText?: string | null;
  category?: string | null;
  channelId?: string | null;
  isOngoing: boolean;
  isGroupSummary: boolean;
  importance?: number | null;
  actionRequired?: boolean | null;
  triageReason?: string | null;
  triagedAt?: number | null;
};

type OpenMuseEdgeEvents = {
  onGenerationToken(event: EdgeTokenEvent): void;
  onGenerationComplete(event: EdgeTokenEvent): void;
  onGenerationError(event: EdgeErrorEvent): void;
};

declare class OpenMuseEdgeNativeModule extends NativeModule<OpenMuseEdgeEvents> {
  getRuntimeStats(): EdgeRuntimeStats;
  loadModel(modelPath: string, backend?: "auto" | "npu" | "gpu" | "cpu"): Promise<EdgeRuntimeStats>;
  unloadModel(): Promise<EdgeRuntimeStats>;
  generate(prompt: string): Promise<string>;
  streamGenerate(prompt: string): Promise<string>;
  cancelGeneration(): boolean;
  sha256File(filePath: string): Promise<string>;
  hasNotificationAccess(): boolean;
  openNotificationAccessSettings(): boolean;
  getRecentNotificationEvents(limit: number): EdgeNotificationEvent[];
  clearNotificationEvents(): boolean;
  updateNotificationTriage(
    id: string,
    importance: number,
    actionRequired: boolean,
    reason: string,
  ): boolean;
}

let cached: OpenMuseEdgeNativeModule | null | undefined;

function nativeModule(): OpenMuseEdgeNativeModule | null {
  if (cached !== undefined) return cached;

  try {
    cached = requireNativeModule<OpenMuseEdgeNativeModule>("OpenMuseEdge");
  } catch {
    cached = null;
  }

  return cached;
}

export const OpenMuseEdge = {
  isAvailable() {
    return nativeModule() !== null;
  },

  getRuntimeStats(): EdgeRuntimeStats {
    const module = nativeModule();
    return module?.getRuntimeStats() ?? { available: false, loaded: false };
  },

  async loadModel(
    modelPath: string,
    backend: "auto" | "npu" | "gpu" | "cpu" = "auto",
  ): Promise<EdgeRuntimeStats> {
    const module = nativeModule();
    if (!module) throw new Error("OpenMuseEdge native module is unavailable in this build.");
    return module.loadModel(modelPath, backend);
  },

  async unloadModel(): Promise<EdgeRuntimeStats> {
    const module = nativeModule();
    if (!module) return { available: false, loaded: false };
    return module.unloadModel();
  },

  async generate(prompt: string): Promise<string> {
    const module = nativeModule();
    if (!module) throw new Error("OpenMuseEdge native module is unavailable in this build.");
    return module.generate(prompt);
  },

  async streamGenerate(prompt: string): Promise<string> {
    const module = nativeModule();
    if (!module) throw new Error("OpenMuseEdge native module is unavailable in this build.");
    return module.streamGenerate(prompt);
  },

  cancelGeneration() {
    return nativeModule()?.cancelGeneration() ?? false;
  },

  async sha256File(filePath: string) {
    const module = nativeModule();
    if (!module) throw new Error("OpenMuseEdge native module is unavailable in this build.");
    return module.sha256File(filePath);
  },

  hasNotificationAccess() {
    return nativeModule()?.hasNotificationAccess() ?? false;
  },

  openNotificationAccessSettings() {
    const module = nativeModule();
    if (!module) throw new Error("OpenMuseEdge native module is unavailable in this build.");
    return module.openNotificationAccessSettings();
  },

  getRecentNotificationEvents(limit = 50): EdgeNotificationEvent[] {
    return nativeModule()?.getRecentNotificationEvents(limit) ?? [];
  },

  clearNotificationEvents() {
    return nativeModule()?.clearNotificationEvents() ?? false;
  },

  updateNotificationTriage(
    id: string,
    importance: number,
    actionRequired: boolean,
    reason: string,
  ) {
    return (
      nativeModule()?.updateNotificationTriage(id, importance, actionRequired, reason) ?? false
    );
  },

  addTokenListener(listener: (event: EdgeTokenEvent) => void) {
    return nativeModule()?.addListener("onGenerationToken", listener) ?? { remove() {} };
  },

  addCompleteListener(listener: (event: EdgeTokenEvent) => void) {
    return nativeModule()?.addListener("onGenerationComplete", listener) ?? { remove() {} };
  },

  addErrorListener(listener: (event: EdgeErrorEvent) => void) {
    return nativeModule()?.addListener("onGenerationError", listener) ?? { remove() {} };
  },
};
