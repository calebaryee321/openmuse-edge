import { useState } from "react";
import { Cpu, HardDrive, LockKeyhole, Sparkles, Zap } from "lucide-react-native";
import { Text, View } from "react-native";
import { Button, Card, Chip, colors, ErrorNotice, Field, s } from "../ui";
import { formatBytes } from "./format";
import { edgeModelManager } from "./model-manager";
import { EDGE_MODEL_TOTAL_GB } from "./model-registry";
import { useEdgeModel } from "./use-model-manager";
import { NotificationIntelligenceCard } from "./notification-intelligence";
import { LocalAppsCard } from "./local-apps";

function StateDot({ active }: { active: boolean }) {
  return (
    <View
      style={{
        width: 8,
        height: 8,
        borderRadius: 8,
        backgroundColor: active ? "#3AA76D" : "#C9CDD2",
      }}
    />
  );
}

function ModelRow({
  name,
  model,
  detail,
  state,
}: {
  name: string;
  model: string;
  detail: string;
  state: string;
}) {
  const active = state === "loaded" || state === "installed";
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 14,
          backgroundColor: active ? "#E9F6EE" : "#F3F4F6",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <StateDot active={active} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={[s.row, { gap: 7, flexWrap: "wrap" }]}>
          <Text style={[s.heading, { fontSize: 15 }]}>{name}</Text>
          <Text style={s.small}>{model}</Text>
        </View>
        <Text style={s.small}>{detail}</Text>
      </View>
      <Text style={[s.small, { fontWeight: "700", textTransform: "capitalize" }]}>
        {state.replace(/-/g, " ")}
      </Text>
    </View>
  );
}

export function DeviceAiCard() {
  const scout = useEdgeModel("scout");
  const muse = useEdgeModel("muse");
  const sage = useEdgeModel("sage");

  return (
    <View style={{ width: "100%", gap: 20 }}>
      <View
        style={{
          borderRadius: 32,
          padding: 24,
          backgroundColor: "#101828",
          overflow: "hidden",
          minHeight: 220,
          justifyContent: "space-between",
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            width: 190,
            height: 190,
            borderRadius: 190,
            right: -58,
            top: -42,
            backgroundColor: "#1E3A5F",
            opacity: 0.78,
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            width: 130,
            height: 130,
            borderRadius: 130,
            right: 40,
            bottom: -70,
            backgroundColor: "#423B78",
            opacity: 0.62,
          }}
        />

        <View style={{ gap: 14, zIndex: 1 }}>
          <View
            style={{
              alignSelf: "flex-start",
              flexDirection: "row",
              alignItems: "center",
              gap: 7,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.12)",
            }}
          >
            <LockKeyhole size={13} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "700" }}>ON-DEVICE</Text>
          </View>

          <View style={{ maxWidth: 300, gap: 8 }}>
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 31,
                lineHeight: 36,
                fontWeight: "700",
                letterSpacing: -1.1,
              }}
            >
              Your AI. On your phone.
            </Text>
            <Text style={{ color: "#CCD5E0", fontSize: 14, lineHeight: 21 }}>
              Chat, learn, and stay on top of what matters without sending your prompts to a remote
              model.
            </Text>
          </View>
        </View>

        <View style={[s.row, { gap: 8, flexWrap: "wrap", zIndex: 1, marginTop: 22 }]}>
          <View
            style={{
              flexDirection: "row",
              gap: 6,
              alignItems: "center",
              paddingHorizontal: 11,
              paddingVertical: 7,
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.10)",
            }}
          >
            <Zap size={13} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "600" }}>Local-first</Text>
          </View>
          <View
            style={{
              paddingHorizontal: 11,
              paddingVertical: 7,
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.10)",
            }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "600" }}>
              {muse.state === "loaded" ? "Muse ready" : "Muse setup"}
            </Text>
          </View>
        </View>
      </View>

      <LocalAppsCard />

      <Card
        style={{
          gap: 4,
          padding: 18,
          borderWidth: 1,
          borderColor: "#ECEEF1",
          shadowColor: "#0F172A",
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.05,
          shadowRadius: 18,
          elevation: 2,
        }}
      >
        <View style={[s.between, { marginBottom: 5 }]}>
          <View style={[s.row, { gap: 10 }]}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 14,
                backgroundColor: "#F2F4F7",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Cpu size={19} color={colors.text} />
            </View>
            <View>
              <Text style={[s.heading, { fontSize: 18 }]}>AI engine</Text>
              <Text style={s.small}>Three local models, one private assistant.</Text>
            </View>
          </View>
          <Chip tint={colors.green}>Edge</Chip>
        </View>

        <ModelRow
          name="Scout"
          model="Qwen 0.8B"
          detail="Fast triage and lightweight tasks"
          state={scout.state}
        />
        <View style={{ height: 1, backgroundColor: colors.line }} />
        <ModelRow
          name="Muse"
          model="Gemma 4 E2B"
          detail="Chat, language, and orchestration"
          state={muse.state}
        />
        <View style={{ height: 1, backgroundColor: colors.line }} />
        <ModelRow
          name="Sage"
          model="Qwen 4B"
          detail="Deeper reasoning when you need it"
          state={sage.state}
        />

        <View
          style={{
            marginTop: 8,
            padding: 12,
            borderRadius: 16,
            backgroundColor: "#F8FAFC",
            flexDirection: "row",
            alignItems: "center",
            gap: 9,
          }}
        >
          <HardDrive size={15} color={colors.muted} />
          <Text style={[s.small, { flex: 1 }]}>
            About {EDGE_MODEL_TOTAL_GB.toFixed(1)} GB for the full local model set.
          </Text>
        </View>
      </Card>

      <MuseModelControls />
      <NotificationIntelligenceCard />
    </View>
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
      ? `${Math.round(model.progress * 100)}%`
      : model.state === "loaded"
        ? "ready"
        : model.localUri
          ? "downloaded"
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
    <Card
      style={{
        gap: 14,
        padding: 18,
        borderWidth: 1,
        borderColor: "#ECEEF1",
        backgroundColor: "#FFFFFF",
      }}
    >
      <View style={[s.between, { gap: 12 }]}>
        <View style={[s.row, { gap: 11, flex: 1 }]}>
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 15,
              backgroundColor: "#E7F4FF",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Sparkles size={19} color={colors.text} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[s.heading, { fontSize: 18 }]}>Muse</Text>
            <Text style={s.small}>Powers Chat, Language Coach, and richer local tasks.</Text>
          </View>
        </View>
        <Chip tint={model.state === "loaded" ? colors.green : undefined}>{progressLabel}</Chip>
      </View>

      {model.freeBytes != null && (
        <Text style={s.small}>
          {formatBytes(model.freeBytes)} free on this phone
        </Text>
      )}

      {model.state === "downloading" && (
        <>
          <View
            style={{
              height: 8,
              borderRadius: 8,
              backgroundColor: "#EDF0F3",
              overflow: "hidden",
            }}
          >
            <View
              style={{
                height: "100%",
                width: `${Math.max(2, Math.round(model.progress * 100))}%`,
                backgroundColor: "#101828",
              }}
            />
          </View>
          <Text style={s.small}>
            {formatBytes(model.bytesWritten)} of {formatBytes(model.totalBytes)}
          </Text>
        </>
      )}

      {!model.localUri && (model.state === "not-installed" || model.state === "error") && (
        <>
          <Text style={s.muted}>
            Install Muse once and OpenMuse can use it offline for private conversations and learning.
          </Text>
          <Field
            label="Hugging Face token · only if required"
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
            Download Muse · ~2.0 GB
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

      {model.state === "installed" && model.localUri && (
        <>
          <View
            style={{
              padding: 13,
              borderRadius: 16,
              backgroundColor: "#F7F9FC",
              gap: 3,
            }}
          >
            <Text style={[s.heading, { fontSize: 14 }]}>Muse is downloaded</Text>
            <Text style={s.small}>
              The model is stored on this phone and will be reused when you update OpenMuse.
            </Text>
          </View>
          <Button primary busy={busy} onPress={() => void act(() => edgeModelManager.load("muse"))}>
            {model.error ? "Retry Muse" : "Start Muse"}
          </Button>
        </>
      )}

      {model.state === "loaded" && (
        <>
          <View
            style={{
              padding: 13,
              borderRadius: 16,
              backgroundColor: "#F1F8F4",
              gap: 3,
            }}
          >
            <Text style={[s.heading, { fontSize: 14 }]}>Muse is ready</Text>
            <Text style={s.small}>
              Running locally · {model.runtime.backend?.toUpperCase() || "AUTO"} backend
            </Text>
          </View>
          <View style={[s.row, { gap: 8, flexWrap: "wrap" }]}>
            <Button
              small
              busy={busy}
              onPress={() =>
                void act(async () => {
                  const response = await edgeModelManager.test();
                  setResult(response);
                })
              }
            >
              Quick test
            </Button>
            <Button small busy={busy} onPress={() => void act(() => edgeModelManager.unload("muse"))}>
              Stop Muse
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
          Remove model
        </Button>
      )}

      {!!result && (
        <View style={{ gap: 4, padding: 14, borderRadius: 16, backgroundColor: "#F8FAFC" }}>
          <Text style={s.small}>Local test</Text>
          <Text selectable style={s.text}>
            {result}
          </Text>
        </View>
      )}

      <ErrorNotice
        error={
          (error || model.error)?.includes("Unable to initialize LiteRT-LM")
            ? "Muse is downloaded, but its local AI engine could not start. The model file was kept on this phone; retry without downloading it again."
            : error || model.error
        }
      />
    </Card>
  );
}
