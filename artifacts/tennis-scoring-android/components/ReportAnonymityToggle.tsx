import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

export function ReportAnonymityToggle({
  hidePlayerNames,
  onToggle,
  testID,
}: {
  hidePlayerNames: boolean;
  onToggle: () => void;
  testID: string;
}) {
  const colors = useColors();

  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityLabel="Hide player names in the report"
      accessibilityState={{ checked: hidePlayerNames }}
      onPress={onToggle}
      style={[
        styles.row,
        {
          backgroundColor: hidePlayerNames ? colors.secondary : colors.card,
          borderColor: hidePlayerNames ? colors.primary : colors.border,
        },
      ]}
    >
      <Ionicons
        name={hidePlayerNames ? 'checkbox' : 'square-outline'}
        size={18}
        color={hidePlayerNames ? colors.primary : colors.mutedForeground}
      />
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          Hide player names
        </Text>
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          Use Player A and Player B in the preview and PDF.
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 49,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  copy: { flex: 1, gap: 2 },
  title: { fontFamily: 'Manrope_700Bold', fontSize: 12 },
  hint: { fontFamily: 'DMSans_400Regular', fontSize: 9, lineHeight: 13 },
});
