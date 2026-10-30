import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

type Section = { id: string; label: string };

export function ReportSectionPicker({
  sections,
  selected,
  onToggle,
  onSelectAll,
  onClear,
  testID,
}: {
  sections: readonly Section[];
  selected: readonly string[];
  onToggle: (section: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  testID: string;
}) {
  const colors = useColors();

  return (
    <View
      testID={testID}
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.heading}>
        <View style={styles.headingCopy}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            PDF report sections
          </Text>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            {selected.length} of {sections.length} selected · match details stay included.
          </Text>
        </View>
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Include all report sections"
            testID={`${testID}-select-all`}
            onPress={onSelectAll}
            hitSlop={6}
          >
            <Text style={[styles.action, { color: colors.primary }]}>All</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear report sections"
            testID={`${testID}-clear`}
            onPress={onClear}
            hitSlop={6}
          >
            <Text style={[styles.action, { color: colors.primary }]}>None</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.options}>
        {sections.map(({ id, label }) => {
          const checked = selected.includes(id);
          return (
            <Pressable
              key={id}
              testID={`${testID}-${id}`}
              accessibilityRole="checkbox"
              accessibilityLabel={label}
              accessibilityState={{ checked }}
              onPress={() => onToggle(id)}
              style={[
                styles.option,
                {
                  borderColor: checked ? colors.primary : colors.border,
                  backgroundColor: checked ? colors.secondary : colors.card,
                },
              ]}
            >
              <Ionicons
                name={checked ? 'checkbox' : 'square-outline'}
                size={16}
                color={checked ? colors.primary : colors.mutedForeground}
              />
              <Text
                numberOfLines={2}
                style={[
                  styles.optionLabel,
                  { color: checked ? colors.foreground : colors.mutedForeground },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 11, gap: 10 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headingCopy: { flex: 1, gap: 2 },
  title: { fontFamily: 'Manrope_700Bold', fontSize: 13 },
  hint: { fontFamily: 'DMSans_400Regular', fontSize: 9 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  action: { fontFamily: 'DMSans_700Bold', fontSize: 10 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  option: {
    width: '47%',
    flexGrow: 1,
    minHeight: 35,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  optionLabel: { flex: 1, fontFamily: 'DMSans_500Medium', fontSize: 9 },
});
