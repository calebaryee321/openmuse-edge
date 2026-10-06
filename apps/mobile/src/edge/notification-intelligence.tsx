import { useEffect, useState } from "react";
import { BellRing, ShieldCheck, Sparkles } from "lucide-react-native";
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
  return score == null ? "new" : `${Math.round(score * 100)}%`;
}

function Stat({
  value,
  label,
  tint,
}: {
  value: string | number;
  label: string;
  tint: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: 92,
        padding: 13,
        borderRadius: 18,
        backgroundColor: tint,
        gap: 3,
      }}
    >
      <Text style={{ color: colors.text, fontSize: 20, fontWeight: "700", letterSpacing: -0.6 }}>
        {value}
      </Text>
      <Text style={s.small}>{label}</Text>
    </View>
  );
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
    <Card
      style={{
        gap: 16,
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
              backgroundColor: "#FFF3E7",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <BellRing size={19} color={colors.text} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[s.heading, { fontSize: 18 }]}>Smart notifications</Text>
            <Text style={s.small}>Let Scout surface what actually needs your attention.</Text>
          </View>
        </View>
        <Chip tint={access ? colors.green : colors.orange}>
          {access ? "On" : "Off"}
        </Chip>
      </View>

      {!access ? (
        <View style={{ gap: 13 }}>
          <View
            style={{
              padding: 14,
              borderRadius: 18,
              backgroundColor: "#F8FAFC",
              flexDirection: "row",
              gap: 10,
              alignItems: "flex-start",
            }}
          >
            <ShieldCheck size={18} color={colors.text} />
            <Text style={[s.muted, { flex: 1 }]}>
              OpenMuse only reads notifications after you explicitly allow it in Android settings.
              You can turn access off at any time.
            </Text>
          </View>
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
            Set up notification access
          </Button>
        </View>
      ) : (
        <>
          <View style={{ flexDirection: "row", gap: 9, flexWrap: "wrap" }}>
            <Stat value={events.length} label="recent" tint="#F3F4F6" />
            <Stat value={important} label="important" tint="#FFF3E7" />
            <Stat value={actionable} label="actionable" tint="#F0ECFF" />
          </View>

          {events.length === 0 ? (
            <View
              style={{
                padding: 16,
                borderRadius: 18,
                backgroundColor: "#F8FAFC",
                gap: 4,
              }}
            >
              <Text style={[s.heading, { fontSize: 14 }]}>You're connected</Text>
              <Text style={s.small}>
                New notifications will appear here as OpenMuse sees them.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {events.slice(0, 4).map((event) => (
                <View
                  key={event.id}
                  style={{
                    gap: 4,
                    padding: 13,
                    borderRadius: 17,
                    backgroundColor: "#F8FAFC",
                  }}
                >
                  <View style={s.between}>
                    <Text
                      numberOfLines={1}
                      style={[s.small, { color: colors.text, fontWeight: "700", flex: 1 }]}
                    >
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
                    {event.actionRequired ? " · may need action" : ""}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}

      <View
        style={{
          padding: 14,
          borderRadius: 19,
          backgroundColor: "#F4F7FB",
          gap: 10,
        }}
      >
        <View style={s.between}>
          <View style={[s.row, { gap: 9, flex: 1 }]}>
            <Sparkles size={17} color={colors.text} />
            <View style={{ flex: 1 }}>
              <Text style={[s.heading, { fontSize: 15 }]}>Scout</Text>
              <Text style={s.small}>Fast, local notification triage.</Text>
            </View>
          </View>
          <Chip tint={["installed", "loaded"].includes(scout.state) ? colors.green : undefined}>
            {scout.state.replace(/-/g, " ")}
          </Chip>
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
                setStatus("Scout is ready.");
              })
            }
          >
            Install Scout · ~1 GB
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
            Pause download
          </Button>
        )}

        {scout.state === "paused" && (
          <Button
            primary
            busy={busy}
            onPress={() =>
              void act(async () => {
                await edgeModelManager.resume("scout");
                setStatus("Scout download resumed.");
              })
            }
          >
            Resume download
          </Button>
        )}

        {["installed", "loaded"].includes(scout.state) && access && events.length > 0 && (
          <Button
            primary
            busy={busy}
            onPress={() =>
              void act(async () => {
                const result = await runScoutNotificationPass(8);
                setStatus(
                  `Scout reviewed ${result.processed} notification${result.processed === 1 ? "" : "s"}.`,
                );
              })
            }
          >
            Review recent notifications
          </Button>
        )}

        {!!status && <Text style={s.small}>{status}</Text>}
      </View>

      {access && events.length > 0 && (
        <View style={[s.row, { gap: 8, flexWrap: "wrap" }]}>
          <Button small onPress={refresh}>
            Refresh
          </Button>
          <Button
            small
            danger
            onPress={() => {
              OpenMuseEdge.clearNotificationEvents();
              refresh();
            }}
          >
            Clear history
          </Button>
        </View>
      )}

      <ErrorNotice error={error || scout.error} />
    </Card>
  );
}
