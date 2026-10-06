import { useState } from "react";
import { Languages, MessageCircle, Sparkles, type LucideIcon } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { Sheet, colors, s } from "../ui";
import { LanguageLearning } from "./language-learning";
import { LocalChat } from "./local-chat";

function AppTile({
  title,
  detail,
  icon: Icon,
  tint,
  onPress,
}: {
  title: string;
  detail: string;
  icon: LucideIcon;
  tint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minWidth: 150,
        minHeight: 164,
        borderRadius: 28,
        padding: 18,
        justifyContent: "space-between",
        backgroundColor: tint,
        transform: [{ scale: pressed ? 0.985 : 1 }],
      })}
    >
      <View
        style={{
          width: 46,
          height: 46,
          borderRadius: 16,
          backgroundColor: "rgba(255,255,255,0.78)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={22} strokeWidth={1.8} color={colors.text} />
      </View>

      <View style={{ gap: 5 }}>
        <Text style={[s.heading, { fontSize: 18 }]}>{title}</Text>
        <Text style={[s.small, { fontSize: 12, lineHeight: 18 }]}>{detail}</Text>
      </View>
    </Pressable>
  );
}

export function LocalAppsCard() {
  const [open, setOpen] = useState<"chat" | "language" | null>(null);

  return (
    <>
      <View style={{ gap: 12 }}>
        <View style={[s.between, { gap: 12 }]}>
          <View style={{ gap: 3 }}>
            <Text style={[s.title, { fontSize: 22 }]}>Your apps</Text>
            <Text style={s.small}>Private tools powered by your on-device AI.</Text>
          </View>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 14,
              backgroundColor: colors.green,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Sparkles size={17} color={colors.text} />
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 12, flexWrap: "wrap" }}>
          <AppTile
            icon={MessageCircle}
            title="Chat"
            detail="Private conversations with Muse, saved only on this device."
            onPress={() => setOpen("chat")}
            tint="#E7F4FF"
          />
          <AppTile
            icon={Languages}
            title="Language"
            detail="Conversation, corrections, vocabulary and travel practice."
            onPress={() => setOpen("language")}
            tint="#F0ECFF"
          />
        </View>
      </View>

      {open === "chat" && (
        <Sheet
          title="Chat with Muse"
          subtitle="Private, local conversation."
          onClose={() => setOpen(null)}
        >
          <LocalChat />
        </Sheet>
      )}

      {open === "language" && (
        <Sheet
          title="Language Coach"
          subtitle="Practice naturally and get instant feedback."
          onClose={() => setOpen(null)}
        >
          <LanguageLearning />
        </Sheet>
      )}
    </>
  );
}
