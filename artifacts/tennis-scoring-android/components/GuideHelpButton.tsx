import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/useColors';
import {
  APP_GUIDE_SECTIONS,
  getAboutGuideHref,
  type AppGuideSectionId,
} from '@/lib/app-guide';

interface GuideHelpButtonProps {
  section: AppGuideSectionId;
  accessibilityLabel?: string;
}

export function GuideHelpButton({
  section,
  accessibilityLabel,
}: GuideHelpButtonProps) {
  const colors = useColors();
  const router = useRouter();
  const guideSection = APP_GUIDE_SECTIONS.find((item) => item.id === section);
  const label =
    accessibilityLabel ??
    (guideSection ? `Help with ${guideSection.navLabel}` : 'Open app help');

  return (
    <Pressable
      testID={`guide-help-${section}`}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens the related instructions in About."
      hitSlop={8}
      onPress={() => router.push(getAboutGuideHref(section) as never)}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Ionicons name="help-circle-outline" size={20} color={colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
