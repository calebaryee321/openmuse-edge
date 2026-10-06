import { useState } from "react";
import { Text, View } from "react-native";
import { Button, Card, Chip, colors, ErrorNotice, Field, SectionHeading, s } from "../ui";
import { formatBytes } from "./format";
import { edgeModelManager } from "./model-manager";
import { EDGE_MODELS, EDGE_MODEL_TOTAL_GB } from "./model-registry";
import { useEdgeModel } from "./use-model-manager";
import { NotificationIntelligenceCard } from "./notification-intelligence";
import { LocalAppsCard } from "./local-apps";

export function DeviceAiCard() {
  return (
    <Card style={{ gap: 14, backgroundColor: colors.sky }}>
      <View style={[s.between, { gap: 12 }]}>
        <View style={{ flex: 1 }}>
          <SectionHeading title="Device AI" />
          <Text style={s.muted}>
            Local-first ensemble for Pixel. Models download to app-private storage and can run
            without sending prompts to a remote LLM.
          </Text>
        </View>
        <Chip tint={colors.green}>Edge v1</Chip>
      </View>

      <View style={{ gap: 10 }}>
        {EDGE_MODELS.map((model) => (
          <View
            key={model.id}
            style={{
              gap: 4,
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderBottomColor: colors.line,
            }}
          >
            <View style={s.between}>
              <Text style={s.heading}>{model.label}</Text>
              <Chip>{model.model}</Chip>
            </View>
            <Text style={s.small}>{model.role}</Text>
            <Text style={s.small}>
              {model.approximateSizeGb.toFixed(2)} GB · {model.preferredBackend.toUpperCase()}
              {model.directToolCalls ? " · tool caller" : " · structured output"}
            </Text>
          </View>
        ))}
      </View>

      <Text style={s.small}>
        Planned local model storage: ~{EDGE_MODEL_TOTAL_GB.toFixed(1)} GB before EmbeddingGemma.
      </Text>

      <LocalAppsCard />
      <MuseModelControls />
      <NotificationIntelligenceCard />
    </Card>
  );
}

function MuseModelControls() {
  const model = useEdgeModel("muse");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  const progressLabel =
    model.state === "downloading"
      ? `${Math.round(model.progress * 100)}% · ${formatBytes(model.bytesWritten)} / ${formatBytes(
          model.totalBytes,
        )}`
      : model.state.replace(/-/g, " ");

  async function act(work: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 12, paddingTop: 6 }}>
      <View style={s.between}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={s.heading}>Muse model manager</Text>
          <Text style={s.small}>Gemma 4 E2B · Tensor G5 package</Text>
        </View>
        <Chip tint={model.state === "loaded" ? colors.green : undefined}>{progressLabel}</Chip>
      </View>

      {model.freeBytes != null && (
        <Text style={s.small}>
          Free device storage: {formatBytes(model.freeBytes)} / {formatBytes(model.totalDiskBytes)}
        </Text>
      )}

      {model.state === "downloading" && (
        <View style={{ height: 7, borderRadius: 6, backgroundColor: colors.line, overflow: "hidden" }}>
          <View
            style={{
              height: "100%",
              width: `${Math.max(2, Math.round(model.progress * 100))}%`,
              backgroundColor: colors.blueDark,
            }}
          />
        </View>
      )}

      {(model.state === "not-installed" || model.state === "error") && (
        <>
          <Field
            label="Hugging Face token (only if the model download requires one)"
            value={token}
            onChangeText={setToken}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="hf_..."
          />
          <Button
            primary
            busy={busy}
            onPress={() =>
              void act(() => edgeModelManager.install("muse", token.trim() || undefined))
            }
          >
            Download Muse
          </Button>
        </>
      )}

      {model.state === "downloading" && (
        <Button busy={busy} onPress={() => void act(() => edgeModelManager.pause("muse"))}>
          Pause download
        </Button>
      )}

      {model.state === "paused" && (
        <Button
          primary
          busy={busy}
          onPress={() =>
            void act(() => edgeModelManager.resume("muse", token.trim() || undefined))
          }
        >
          Resume download
        </Button>
      )}

      {model.state === "installed" && (
        <Button primary busy={busy} onPress={() => void act(() => edgeModelManager.load("muse"))}>
          Load Muse locally
        </Button>
      )}

      {model.state === "loaded" && (
        <>
          <Text style={s.small}>
            Runtime: {model.runtime.backend?.toUpperCase() || "AUTO"} · local file loaded
          </Text>
          <View style={[s.row, { gap: 8, flexWrap: "wrap" }]}>
            <Button
              small
              primary
              busy={busy}
              onPress={() =>
                void act(async () => {
                  const response = await edgeModelManager.test();
                  setResult(response);
                })
              }
            >
              Test local AI
            </Button>
            <Button small busy={busy} onPress={() => void act(() => edgeModelManager.unload("muse"))}>
              Unload
            </Button>
          </View>
        </>
      )}

      {["installed", "loaded", "error"].includes(model.state) && model.localUri && (
        <Button
          small
          danger
          busy={busy}
          onPress={() => void act(() => edgeModelManager.remove("muse"))}
        >
          Delete local model
        </Button>
      )}

      {!!result && (
        <Card style={{ gap: 4, padding: 14, backgroundColor: colors.card }}>
          <Text style={s.small}>Local inference result</Text>
          <Text selectable style={s.text}>
            {result}
          </Text>
        </Card>
      )}

      <ErrorNotice error={error || model.error} />
      <Text style={s.small}>
        Model weights are not committed to Git. If Hugging Face requires license acceptance,
        accept it on the model page and use a token for this one download session.
      </Text>
    </View>
  );
}
