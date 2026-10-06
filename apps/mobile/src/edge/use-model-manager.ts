import { useEffect, useState } from "react";
import { edgeModelManager, type ModelManagerSnapshot } from "./model-manager";
import type { EdgeAgentId } from "./types";

export function useEdgeModel(modelId: EdgeAgentId): ModelManagerSnapshot {
  const [, rerender] = useState(0);

  useEffect(() => {
    const unsubscribe = edgeModelManager.subscribe(() => rerender((value) => value + 1));
    void edgeModelManager.refresh(modelId);
    return unsubscribe;
  }, [modelId]);

  return edgeModelManager.getSnapshot(modelId);
}
