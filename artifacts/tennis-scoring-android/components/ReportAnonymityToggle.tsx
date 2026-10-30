import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import {
  getLocalReportNameLabelsError,
  type LocalReportNameLabels,
} from '@/lib/local-report-labels';

export function ReportAnonymityToggle({
  hidePlayerNames,
  onToggle,
  testID,
  labels,
  labelsReady,
  labelsDirty,
  labelsSaving,
  labelsError,
  onLabelsChange,
  onSaveLabels,
}: {
  hidePlayerNames: boolean;
  onToggle: () => void;
  testID: string;
  labels: LocalReportNameLabels;
  labelsReady: boolean;
  labelsDirty: boolean;
  labelsSaving: boolean;
  labelsError: string;
  onLabelsChange: (labels: LocalReportNameLabels) => void;
  onSaveLabels: () => void;
}) {
  const colors = useColors();
  const validationError = getLocalReportNameLabelsError(labels);
  const canSaveLabels =
    labelsReady && labelsDirty && !labelsSaving && validationError === null;

  return (
    <View
      testID={`${testID}-panel`}
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
        },
      ]}
    >
      <Pressable
        testID={testID}
        accessibilityRole="checkbox"
        accessibilityLabel="Hide player names in the report"
        accessibilityState={{ checked: hidePlayerNames }}
        onPress={onToggle}
        style={styles.row}
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
            Replace them with neutral labels in previews and PDFs.
          </Text>
        </View>
      </Pressable>

      {hidePlayerNames ? (
        <View style={[styles.labelEditor, { borderTopColor: colors.border }]}>
          <Text style={[styles.editorTitle, { color: colors.foreground }]}>
            Neutral labels
          </Text>
          <View style={styles.fields}>
            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                Player A
              </Text>
              <TextInput
                testID={`${testID}-player-a`}
                accessibilityLabel="Neutral label for the tracked player"
                value={labels.trackedPlayer}
                onChangeText={(trackedPlayer) =>
                  onLabelsChange({ ...labels, trackedPlayer })
                }
                editable={labelsReady && !labelsSaving}
                maxLength={32}
                autoCapitalize="words"
                returnKeyType="next"
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.foreground,
                  },
                ]}
              />
            </View>
            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>
                Player B
              </Text>
              <TextInput
                testID={`${testID}-player-b`}
                accessibilityLabel="Neutral label for the opponent"
                value={labels.opponent}
                onChangeText={(opponent) => onLabelsChange({ ...labels, opponent })}
                editable={labelsReady && !labelsSaving}
                maxLength={32}
                autoCapitalize="words"
                returnKeyType="done"
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.foreground,
                  },
                ]}
              />
            </View>
          </View>
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>
            Stored only on this device and used in both report types. Do not enter real names.
          </Text>
          {validationError || labelsError ? (
            <Text
              accessibilityRole="alert"
              style={[styles.error, { color: colors.destructive }]}
            >
              {validationError ?? labelsError}
            </Text>
          ) : null}
          <Pressable
            testID={`${testID}-save-labels`}
            accessibilityRole="button"
            accessibilityLabel="Save neutral report labels on this device"
            disabled={!canSaveLabels}
            onPress={onSaveLabels}
            style={[
              styles.saveButton,
              {
                backgroundColor: colors.primary,
                opacity: canSaveLabels ? 1 : 0.5,
              },
            ]}
          >
            <Ionicons
              name={labelsSaving ? 'time-outline' : 'checkmark'}
              size={15}
              color={colors.primaryForeground}
            />
            <Text style={[styles.saveButtonText, { color: colors.primaryForeground }]}>
              {labelsSaving ? 'Saving…' : 'Save labels'}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 8,
    gap: 8,
  },
  row: {
    minHeight: 49,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  copy: { flex: 1, gap: 2 },
  title: { fontFamily: 'Manrope_700Bold', fontSize: 12 },
  hint: { fontFamily: 'DMSans_400Regular', fontSize: 9, lineHeight: 13 },
  labelEditor: { borderTopWidth: 1, paddingTop: 9, gap: 7 },
  editorTitle: { fontFamily: 'Manrope_700Bold', fontSize: 11 },
  fields: { flexDirection: 'row', gap: 8 },
  field: { flex: 1, gap: 4 },
  fieldLabel: { fontFamily: 'DMSans_700Bold', fontSize: 9 },
  input: {
    minHeight: 38,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontFamily: 'DMSans_500Medium',
    fontSize: 11,
  },
  error: { fontFamily: 'DMSans_500Medium', fontSize: 10 },
  saveButton: {
    minHeight: 34,
    borderRadius: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  saveButtonText: { fontFamily: 'DMSans_700Bold', fontSize: 10 },
});
