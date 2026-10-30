import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useColors } from '@/hooks/useColors';
import {
  getLocalReportBenchmarkSettings,
  LOCAL_REPORT_BENCHMARKS_KEY,
  MAX_SELECTED_REPORT_BENCHMARKS,
  removeLocalReportBenchmarkPreset,
  saveLocalReportBenchmarkPreset,
  setSelectedLocalReportBenchmarkPresets,
  type LocalReportBenchmarkInput,
  type LocalReportBenchmarkPreset,
} from '@/lib/local-benchmarks';

interface BenchmarkDraft {
  presetId: string | null;
  name: string;
  firstServePointsWon: string;
  secondServePointsWon: string;
  serviceGamesWon: string;
}

function formatPercent(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(1)}%`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Could not save report benchmarks.';
}

function draftFromPreset(preset?: LocalReportBenchmarkPreset): BenchmarkDraft {
  return {
    presetId: preset?.id ?? null,
    name: preset?.name ?? '',
    firstServePointsWon: preset?.firstServePointsWon?.toString() ?? '',
    secondServePointsWon: preset?.secondServePointsWon?.toString() ?? '',
    serviceGamesWon: preset?.serviceGamesWon?.toString() ?? '',
  };
}

function parsePercent(value: string, label: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;
  if (!/^\d{1,3}(?:\.\d)?$/.test(normalized)) {
    throw new Error(`${label} must be a number from 0 to 100.`);
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new Error(`${label} must be a number from 0 to 100.`);
  }
  return parsed;
}

export function ReportBenchmarkManager() {
  const colors = useColors();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<BenchmarkDraft | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [formError, setFormError] = useState('');
  const settingsQuery = useQuery({
    queryKey: LOCAL_REPORT_BENCHMARKS_KEY,
    queryFn: getLocalReportBenchmarkSettings,
  });
  const settings = settingsQuery.data;
  const selectedIds = settings?.selectedPresetIds ?? [];
  const selectedNames = settings
    ? selectedIds
        .map((id) => settings.presets.find((preset) => preset.id === id)?.name)
        .filter((name): name is string => Boolean(name))
    : [];

  async function saveSelection(selectedPresetIds: string[]) {
    setIsSaving(true);
    setActionError('');
    try {
      const updated = await setSelectedLocalReportBenchmarkPresets(selectedPresetIds);
      queryClient.setQueryData(LOCAL_REPORT_BENCHMARKS_KEY, updated);
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleSelection(presetId: string) {
    if (!settings || isSaving) return;
    const isSelected = settings.selectedPresetIds.includes(presetId);
    if (!isSelected && settings.selectedPresetIds.length >= MAX_SELECTED_REPORT_BENCHMARKS) {
      setActionError(
        `Choose up to ${MAX_SELECTED_REPORT_BENCHMARKS} references for a readable report.`,
      );
      return;
    }
    const next = isSelected
      ? settings.selectedPresetIds.filter((id) => id !== presetId)
      : [...settings.selectedPresetIds, presetId];
    await saveSelection(next);
  }

  async function saveDraft() {
    if (!draft || isSaving) return;
    setFormError('');
    setIsSaving(true);
    try {
      const input: LocalReportBenchmarkInput = {
        name: draft.name,
        firstServePointsWon: parsePercent(draft.firstServePointsWon, 'First-serve points won'),
        secondServePointsWon: parsePercent(
          draft.secondServePointsWon,
          'Second-serve points won',
        ),
        serviceGamesWon: parsePercent(draft.serviceGamesWon, 'Service games won'),
      };
      const updated = await saveLocalReportBenchmarkPreset(input, draft.presetId ?? undefined);
      queryClient.setQueryData(LOCAL_REPORT_BENCHMARKS_KEY, updated);
      setDraft(null);
      setFormError('');
      setActionError('');
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }

  function confirmRemove(preset: LocalReportBenchmarkPreset) {
    Alert.alert(
      'Remove report benchmark?',
      `“${preset.name}” will be removed from this device and future reports.`,
      [
        { text: 'Keep preset', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setIsSaving(true);
              setActionError('');
              try {
                const updated = await removeLocalReportBenchmarkPreset(preset.id);
                queryClient.setQueryData(LOCAL_REPORT_BENCHMARKS_KEY, updated);
              } catch (error) {
                setActionError(errorMessage(error));
              } finally {
                setIsSaving(false);
              }
            })();
          },
        },
      ],
    );
  }

  function closeManager() {
    if (!isSaving) {
      setDraft(null);
      setFormError('');
      setActionError('');
      setIsOpen(false);
    }
  }

  return (
    <>
      <View
        style={[
          styles.summaryCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.summaryCopy}>
          <Text style={[styles.summaryTitle, { color: colors.foreground }]}>
            REPORT BENCHMARKS
          </Text>
          <Text
            style={[
              styles.summaryDetail,
              { color: settingsQuery.isError ? colors.destructive : colors.mutedForeground },
            ]}
          >
            {settingsQuery.isLoading
              ? 'Loading saved references…'
              : settingsQuery.isError
                ? errorMessage(settingsQuery.error)
                : selectedNames.length
                  ? `${selectedNames.length} selected · ${selectedNames.join(' · ')}`
                  : 'No user references selected'}
          </Text>
        </View>
        <Pressable
          testID="button-manage-report-benchmarks"
          accessibilityRole="button"
          disabled={!settings || settingsQuery.isError}
          onPress={() => {
            setActionError('');
            setIsOpen(true);
          }}
          style={[
            styles.manageButton,
            {
              borderColor: colors.border,
              opacity: !settings || settingsQuery.isError ? 0.55 : 1,
            },
          ]}
        >
          <Ionicons name="options-outline" size={15} color={colors.primary} />
          <Text style={[styles.manageButtonText, { color: colors.primary }]}>Manage</Text>
        </Pressable>
      </View>
      <Text style={[styles.offlineNote, { color: colors.mutedForeground }]}>
        Presets stay on this device. Reports label them as user references.
      </Text>

      <Modal
        visible={isOpen}
        animationType="slide"
        onRequestClose={closeManager}
      >
        <SafeAreaView
          style={[styles.modalSafeArea, { backgroundColor: colors.background }]}
        >
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Pressable
              testID="button-close-report-benchmarks"
              accessibilityRole="button"
              accessibilityLabel="Close report benchmarks"
              disabled={isSaving}
              onPress={closeManager}
              style={styles.iconButton}
            >
              <Ionicons name="close" size={23} color={colors.foreground} />
            </Pressable>
            <View style={styles.modalTitleGroup}>
              <Text style={[styles.eyebrow, { color: colors.accent }]}>
                OFFLINE REPORT SETTINGS
              </Text>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {draft ? (draft.presetId ? 'Edit benchmark' : 'New benchmark') : 'Benchmarks'}
              </Text>
            </View>
            <View style={styles.headerSpacer} />
          </View>

          {draft ? (
            <KeyboardAwareScrollViewCompat
              style={styles.formScroll}
              contentContainerStyle={styles.formContent}
              bottomOffset={28}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={[styles.formNote, { color: colors.mutedForeground }]}>
                Add user-provided values from 0 to 100. Blank values are omitted from the report.
              </Text>
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Preset name</Text>
              <TextInput
                testID="benchmark-name-input"
                accessibilityLabel="Benchmark preset name"
                value={draft.name}
                onChangeText={(name) => setDraft((current) => current && { ...current, name })}
                maxLength={60}
                autoCapitalize="words"
                placeholder="e.g. Season target"
                placeholderTextColor={colors.mutedForeground}
                style={[
                  styles.textInput,
                  {
                    color: colors.foreground,
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                  },
                ]}
              />
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>
                First-serve points won
              </Text>
              <TextInput
                testID="benchmark-first-serve-input"
                accessibilityLabel="First-serve points won benchmark percentage"
                value={draft.firstServePointsWon}
                onChangeText={(value) =>
                  setDraft((current) => current && { ...current, firstServePointsWon: value })
                }
                keyboardType="decimal-pad"
                maxLength={5}
                placeholder="e.g. 75.1"
                placeholderTextColor={colors.mutedForeground}
                style={[
                  styles.textInput,
                  {
                    color: colors.foreground,
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                  },
                ]}
              />
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>
                Second-serve points won
              </Text>
              <TextInput
                testID="benchmark-second-serve-input"
                accessibilityLabel="Second-serve points won benchmark percentage"
                value={draft.secondServePointsWon}
                onChangeText={(value) =>
                  setDraft((current) => current && { ...current, secondServePointsWon: value })
                }
                keyboardType="decimal-pad"
                maxLength={5}
                placeholder="e.g. 56.4"
                placeholderTextColor={colors.mutedForeground}
                style={[
                  styles.textInput,
                  {
                    color: colors.foreground,
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                  },
                ]}
              />
              <Text style={[styles.fieldLabel, { color: colors.foreground }]}>
                Service games won
              </Text>
              <TextInput
                testID="benchmark-service-games-input"
                accessibilityLabel="Service games won benchmark percentage"
                value={draft.serviceGamesWon}
                onChangeText={(value) =>
                  setDraft((current) => current && { ...current, serviceGamesWon: value })
                }
                keyboardType="decimal-pad"
                maxLength={5}
                placeholder="e.g. 86.8"
                placeholderTextColor={colors.mutedForeground}
                style={[
                  styles.textInput,
                  {
                    color: colors.foreground,
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                  },
                ]}
              />
              {formError ? (
                <View
                  testID="benchmark-form-error"
                  accessibilityRole="alert"
                  style={[styles.errorBanner, { borderColor: colors.destructive }]}
                >
                  <Text style={[styles.errorText, { color: colors.destructive }]}>
                    {formError}
                  </Text>
                </View>
              ) : null}
              <View style={styles.formActions}>
                <Pressable
                  testID="button-cancel-benchmark"
                  accessibilityRole="button"
                  disabled={isSaving}
                  onPress={() => {
                    setDraft(null);
                    setFormError('');
                  }}
                  style={[styles.secondaryAction, { borderColor: colors.border }]}
                >
                  <Text style={[styles.secondaryActionText, { color: colors.foreground }]}>
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  testID="button-save-benchmark"
                  accessibilityRole="button"
                  disabled={isSaving}
                  onPress={() => void saveDraft()}
                  style={[
                    styles.primaryAction,
                    { backgroundColor: colors.primary, opacity: isSaving ? 0.6 : 1 },
                  ]}
                >
                  <Text style={[styles.primaryActionText, { color: colors.primaryForeground }]}>
                    {isSaving ? 'Saving…' : 'Save preset'}
                  </Text>
                </Pressable>
              </View>
            </KeyboardAwareScrollViewCompat>
          ) : (
            <ScrollView
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={[styles.formNote, { color: colors.mutedForeground }]}>
                Select up to {MAX_SELECTED_REPORT_BENCHMARKS} references for the PDF. The report
                uses generic source labels and never prints preset names.
              </Text>
              {settingsQuery.isLoading ? (
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  Loading saved benchmarks…
                </Text>
              ) : null}
              {settingsQuery.isError ? (
                <View
                  accessibilityRole="alert"
                  style={[styles.errorBanner, { borderColor: colors.destructive }]}
                >
                  <Text style={[styles.errorText, { color: colors.destructive }]}>
                    {errorMessage(settingsQuery.error)}
                  </Text>
                </View>
              ) : null}
              {settings?.presets.map((preset) => {
                const selected = settings.selectedPresetIds.includes(preset.id);
                const selectionBlocked =
                  !selected &&
                  settings.selectedPresetIds.length >= MAX_SELECTED_REPORT_BENCHMARKS;
                return (
                  <View
                    key={preset.id}
                    style={[
                      styles.presetRow,
                      { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                  >
                    <Pressable
                      testID={`report-benchmark-select-${preset.id}`}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected, disabled: isSaving || selectionBlocked }}
                      disabled={isSaving || selectionBlocked}
                      onPress={() => void toggleSelection(preset.id)}
                      style={styles.presetSelect}
                    >
                      <Ionicons
                        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                        size={20}
                        color={selected ? colors.primary : colors.mutedForeground}
                      />
                      <View style={styles.presetCopy}>
                        <Text style={[styles.presetName, { color: colors.foreground }]}>
                          {preset.name}
                        </Text>
                        <Text style={[styles.presetValues, { color: colors.mutedForeground }]}>
                          1st {formatPercent(preset.firstServePointsWon)} · 2nd{' '}
                          {formatPercent(preset.secondServePointsWon)} · games{' '}
                          {formatPercent(preset.serviceGamesWon)}
                        </Text>
                      </View>
                    </Pressable>
                    <Pressable
                      testID={`report-benchmark-edit-${preset.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${preset.name}`}
                      disabled={isSaving}
                      onPress={() => {
                        setActionError('');
                        setDraft(draftFromPreset(preset));
                      }}
                      style={styles.rowIconButton}
                    >
                      <Ionicons name="create-outline" size={18} color={colors.primary} />
                    </Pressable>
                    <Pressable
                      testID={`report-benchmark-delete-${preset.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${preset.name}`}
                      disabled={isSaving}
                      onPress={() => confirmRemove(preset)}
                      style={styles.rowIconButton}
                    >
                      <Ionicons name="trash-outline" size={17} color={colors.destructive} />
                    </Pressable>
                  </View>
                );
              })}
              {settings?.presets.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  No saved benchmarks. Add one to compare later reports with your own reference values.
                </Text>
              ) : null}
              {actionError ? (
                <View
                  accessibilityRole="alert"
                  style={[styles.errorBanner, { borderColor: colors.destructive }]}
                >
                  <Text style={[styles.errorText, { color: colors.destructive }]}>
                    {actionError}
                  </Text>
                </View>
              ) : null}
              <Pressable
                testID="button-add-benchmark"
                accessibilityRole="button"
                disabled={isSaving || settingsQuery.isError}
                onPress={() => {
                  setActionError('');
                  setDraft(draftFromPreset());
                }}
                style={[
                  styles.addPresetButton,
                  { borderColor: colors.primary, opacity: isSaving ? 0.6 : 1 },
                ]}
              >
                <Ionicons name="add" size={18} color={colors.primary} />
                <Text style={[styles.addPresetText, { color: colors.primary }]}>
                  Add benchmark
                </Text>
              </Pressable>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    marginTop: 9,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  summaryCopy: { flex: 1, gap: 3 },
  summaryTitle: { fontFamily: 'DMSans_700Bold', fontSize: 8, letterSpacing: 0.8 },
  summaryDetail: { fontFamily: 'DMSans_400Regular', fontSize: 9, lineHeight: 13 },
  manageButton: {
    minHeight: 34,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  manageButtonText: { fontFamily: 'DMSans_700Bold', fontSize: 9 },
  offlineNote: { marginTop: 4, marginHorizontal: 2, fontFamily: 'DMSans_400Regular', fontSize: 8 },
  modalSafeArea: { flex: 1 },
  modalHeader: {
    minHeight: 66,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  modalTitleGroup: { flex: 1, gap: 2 },
  eyebrow: { fontFamily: 'DMSans_700Bold', fontSize: 8, letterSpacing: 1 },
  modalTitle: { fontFamily: 'Manrope_700Bold', fontSize: 18 },
  headerSpacer: { width: 38 },
  formScroll: { flex: 1 },
  formContent: { padding: 18, paddingBottom: 36 },
  listContent: { padding: 16, paddingBottom: 34, gap: 9 },
  formNote: { marginBottom: 10, fontFamily: 'DMSans_400Regular', fontSize: 11, lineHeight: 16 },
  fieldLabel: { marginTop: 8, marginBottom: 5, fontFamily: 'DMSans_600SemiBold', fontSize: 10 },
  textInput: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 11,
    fontFamily: 'DMSans_400Regular',
    fontSize: 14,
  },
  formActions: { flexDirection: 'row', gap: 9, marginTop: 20 },
  secondaryAction: {
    minHeight: 44,
    flex: 1,
    borderWidth: 1,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionText: { fontFamily: 'DMSans_600SemiBold', fontSize: 12 },
  primaryAction: {
    minHeight: 44,
    flex: 1,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionText: { fontFamily: 'DMSans_700Bold', fontSize: 12 },
  errorBanner: { borderWidth: 1, borderRadius: 8, padding: 9 },
  errorText: { fontFamily: 'DMSans_500Medium', fontSize: 10, lineHeight: 14 },
  presetRow: {
    minHeight: 68,
    borderWidth: 1,
    borderRadius: 10,
    paddingLeft: 10,
    paddingRight: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  presetSelect: { flex: 1, minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 8 },
  presetCopy: { flex: 1, gap: 3 },
  presetName: { fontFamily: 'DMSans_700Bold', fontSize: 11 },
  presetValues: { fontFamily: 'DMSans_400Regular', fontSize: 8, lineHeight: 12 },
  rowIconButton: { width: 35, height: 38, alignItems: 'center', justifyContent: 'center' },
  emptyText: { paddingVertical: 8, fontFamily: 'DMSans_400Regular', fontSize: 11, lineHeight: 16 },
  addPresetButton: {
    minHeight: 43,
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addPresetText: { fontFamily: 'DMSans_700Bold', fontSize: 11 },
});
