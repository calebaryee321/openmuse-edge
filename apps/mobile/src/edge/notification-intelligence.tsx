import { useEffect, useState } from "react";
import { AppState, Text, View } from "react-native";
import { Button, Card, Chip, colors, ErrorNotice, s } from "../ui";
import { formatBytes } from "./format";
import { edgeModelManager } from "./model-manager";
import { OpenMuseEdge, type EdgeNotificationEvent } from "./native";
import { runScoutNotificationPass } from "./scout";
import { useEdgeModel } from "./use-model-manager";

function appLabel(packageName: string) {
  const parts = packageName.split(".");
  return parts.at(-1)?.replace(/_/g, " ") || packageName;
}

function scoreLabel(score?: number | null) {
  return score == null ? "untriaged" : `${Math.round(score * 100)}%`;
}

export function NotificationIntelligenceCard() {
  const scout = useEdgeModel("scout");
  const [access, setAccess] = useState(false);
  const [events, setEvents] = useState<EdgeNotificationEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  function refresh() {
    setAccess(OpenMuseEdge.hasNotificationAccess());
    setEvents(OpenMuseEdge.getRecentNotificationEvents(12));
  }

  useEffect(() => {
    refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => subscription.remove();
  }, []);

  async function act(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
      refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : String(value));
    } finally {
      setBusy(false);
    }
  }

  const important = events.filter((event) => (event.importance ?? 0) >= 0.72).length;
  const actionable = events.filter((event) => event.actionRequired).length;

  return (
    <Card style={{ gap: 14, backgroundColor: colors.card }}>
      <View style={s.between}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={s.heading}>Notification intelligence</Text>
          <Text style={s.small}>
            Local event capture with deterministic pre-triage and optional Qwen Scout refinement.
          </Text>
        </View>
        <Chip tint={access ? colors.green : colors.orange}>
          {access ? "Access on" : "Access off"}
        </Chip>
      </View>

      {!access ? (
        <>
          <Text style={s.muted}>
            Android requires you to explicitly allow OpenMuse to read notifications. You can revoke
            this at any time in system settings.
          </Text>
          <Button
            primary
            onPress={() => {
              try {
                OpenMuseEdge.openNotificationAccessSettings();
              } catch (value) {
                setError(value instanceof Error ? value.message : String(value));
              }
            }}
          >
            Grant notification access
          </Button>
        </>
      ) : (
        <>
          <View style={[s.row, { gap: 8, flexWrap: "wrap" }]}>
            <Chip>{events.length} recent</Chip>
            <Chip tint={important ? colors.orange : undefined}>{important} important</Chip>
            <Chip tint={actionable ? colors.lavender : undefined}>{actionable} actionable</Chip>
          </View>
          <Button small onPress={refresh}>
            Refresh events
          </Button>
        </>
      )}

      <View style={{ gap: 10 }}>
        {events.slice(0, 6).map((event) => (
          <View
            key={event.id}
            style={{ gap: 3, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: colors.line }}
          >
            <View style={s.between}>
              <Text numberOfLines={1} style={[s.small, { color: colors.text, fontWeight: "600", flex: 1 }]}>
                {event.title || appLabel(event.packageName)}
              </Text>
              <Chip tint={(event.importance ?? 0) >= 0.72 ? colors.orange : undefined}>
                {scoreLabel(event.importance)}
              </Chip>
            </View>
            {!!event.text && (
              <Text numberOfLines={2} style={s.small}>
                {event.text}
              </Text>
            )}
            <Text style={s.small}>
              {appLabel(event.packageName)}
              {event.actionRequired ? " · action likely" : ""}
              {event.triageReason ? ` · ${event.triageReason}` : ""}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ gap: 8, paddingTop: 4 }}>
        <View style={s.between}>
          <View style={{ flex: 1 }}>
            <Text style={s.heading}>Scout</Text>
            <Text style={s.small}>Qwen3.5 0.8B · local structured triage</Text>
          </View>
          <Chip>{scout.state.replace(/-/g, " ")}</Chip>
        </View>

        {scout.state === "downloading" && (
          <Text style={s.small}>
            {Math.round(scout.progress * 100)}% · {formatBytes(scout.bytesWritten)} /{" "}
            {formatBytes(scout.totalBytes)}
          </Text>
        )}

        {["not-installed", "error"].includes(scout.state) && (
          <Button
            busy={busy}
            onPress={() =>
              void act(async () => {
                await edgeModelManager.install("scout");
                setStatus("Scout downloaded.");
              })
            }
          >
            Download Scout (~0.96 GB)
          </Button>
        )}

        {scout.state === "downloading" && (
          <Button
            busy={busy}
            onPress={() =>
              void act(async () => {
                await edgeModelManager.pause("scout");
                setStatus("Scout download paused.");
              })
            }
          >
            Pause Scout download
          </Button>
        )}

        {scout.state === "paused" && (
          <Button
            busy={busy}
            onPress={() =>
              void act(async () => {
                await edgeModelManager.resume("scout");
                setStatus("Scout download resumed.");
              })
            }
          >
            Resume Scout download
          </Button>
        )}

        {["installed", "loaded"].includes(scout.state) && access && events.length > 0 && (
          <Button
            primary
            busy={busy}
            onPress={() =>
              void act(async () => {
                const result = await runScoutNotificationPass(8);
                setStatus(`Scout refined ${result.processed} notification${result.processed === 1 ? "" : "s"}.`);
              })
            }
          >
            Run Scout on recent notifications
          </Button>
        )}

        {!!status && <Text style={s.small}>{status}</Text>}
      </View>

      {access && events.length > 0 && (
        <Button
          small
          danger
          onPress={() => {
            OpenMuseEdge.clearNotificationEvents();
            refresh();
          }}
        >
          Clear local notification history
        </Button>
      )}

      <ErrorNotice error={error || scout.error} />
      <Text style={s.small}>
        Raw notification events remain on-device in a bounded local queue. The current background
        worker performs cheap deterministic pre-triage; Scout refinement uses the local Qwen model
        when you run it.
      </Text>
    </Card>
  );
}
