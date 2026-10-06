import { Text, View } from "react-native";
import { Card, Chip, colors, SectionHeading, s } from "../ui";
import { EDGE_MODELS, EDGE_MODEL_TOTAL_GB } from "./model-registry";

export function DeviceAiCard() {
  return (
    <Card style={{ gap: 14, backgroundColor: colors.sky }}>
      <View style={[s.between, { gap: 12 }]}>
        <View style={{ flex: 1 }}>
          <SectionHeading title="Device AI" />
          <Text style={s.muted}>
            Local-first ensemble planned for Pixel. Models will download to app-private storage,
            not ship in Git.
          </Text>
        </View>
        <Chip tint={colors.green}>Edge scaffold</Chip>
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
    </Card>
  );
}
