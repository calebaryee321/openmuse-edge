import { useState } from "react";
import { Languages, MessageCircle } from "lucide-react-native";
import { Text, View } from "react-native";
import { Card, LinkRow, SectionHeading, Sheet, colors, s } from "../ui";
import { LanguageLearning } from "./language-learning";
import { LocalChat } from "./local-chat";

export function LocalAppsCard() {
  const [open, setOpen] = useState<"chat" | "language" | null>(null);

  return (
    <>
      <Card style={{ gap: 4, backgroundColor: colors.card }}>
        <SectionHeading title="Local apps" />
        <Text style={[s.muted, { marginBottom: 4 }]}>
          Private tools that run through the on-device Muse model.
        </Text>

        <LinkRow
          icon={MessageCircle}
          title="Local Chat"
          detail="Private multi-turn chat with persistent on-device history."
          onPress={() => setOpen("chat")}
          tint={colors.sky}
        />
        <LinkRow
          icon={Languages}
          title="Language Coach"
          detail="Conversation, corrections, vocabulary and travel role-play."
          onPress={() => setOpen("language")}
          tint={colors.lavender}
        />

        <View style={{ paddingTop: 6 }}>
          <Text style={s.small}>
            More local apps can plug into this same hub without requiring a remote workspace.
          </Text>
        </View>
      </Card>

      {open === "chat" && (
        <Sheet
          title="Local Chat"
          subtitle="Private conversation powered by Muse on this device."
          onClose={() => setOpen(null)}
        >
          <LocalChat />
        </Sheet>
      )}

      {open === "language" && (
        <Sheet
          title="Language Coach"
          subtitle="Practice naturally, get corrections, and build useful vocabulary."
          onClose={() => setOpen(null)}
        >
          <LanguageLearning />
        </Sheet>
      )}
    </>
  );
}
