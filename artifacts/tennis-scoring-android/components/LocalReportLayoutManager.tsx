import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import {
  deleteLocalReportLayout,
  listLocalReportLayouts,
  LOCAL_REPORT_LAYOUTS_KEY,
  renameLocalReportLayout,
  saveLocalReportLayout,
  type LocalReportLayout,
  type ReportLayoutType,
} from '@/lib/local-report-layouts';

type Section<TSection extends string> = { id: TSection; label: string };
type LayoutEditor =
  | { mode: 'save' }
  | { mode: 'rename'; layout: LocalReportLayout };

export function LocalReportLayoutManager<TSection extends string>({
  reportType,
  sections,
  selected,
  onApply,
  testID,
}: {
  reportType: ReportLayoutType;
  sections: readonly Section<TSection>[];
  selected: readonly TSection[];
  onApply: (sections: readonly TSection[]) => void;
  testID: string;
}) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const layoutsQuery = useQuery({
    queryKey: LOCAL_REPORT_LAYOUTS_KEY,
    queryFn: listLocalReportLayouts,
  });
  const [layoutEditor, setLayoutEditor] = useState<LayoutEditor | null>(null);
  const [layoutName, setLayoutName] = useState('');
  const [layoutError, setLayoutError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const layouts = (layoutsQuery.data ?? []).filter(
    (layout) => layout.reportType === reportType,
  );

  function openSaveDialog() {
    setLayoutName('');
    setLayoutError('');
    setLayoutEditor({ mode: 'save' });
  }

  function openRenameDialog(layout: LocalReportLayout) {
    setLayoutName(layout.name);
    setLayoutError('');
    setLayoutEditor({ mode: 'rename', layout });
  }

  function closeDialog() {
    if (isSaving) return;
    setLayoutEditor(null);
    setLayoutError('');
  }

  async function saveLayout() {
    if (!layoutEditor || isSaving) return;
    setIsSaving(true);
    setLayoutError('');
    try {
      const updated =
        layoutEditor.mode === 'save'
          ? await saveLocalReportLayout(reportType, layoutName, selected)
          : await renameLocalReportLayout(layoutEditor.layout.id, layoutName);
      queryClient.setQueryData(LOCAL_REPORT_LAYOUTS_KEY, updated);
      setLayoutEditor(null);
    } catch (error) {
      setLayoutError(
        error instanceof Error ? error.message : 'Could not save this layout.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function removeLayout(layout: LocalReportLayout) {
    setLayoutError('');
    try {
      const updated = await deleteLocalReportLayout(layout.id);
      queryClient.setQueryData(LOCAL_REPORT_LAYOUTS_KEY, updated);
    } catch (error) {
      setLayoutError(
        error instanceof Error ? error.message : 'Could not remove this layout.',
      );
    }
  }

  function confirmDelete(layout: LocalReportLayout) {
    Alert.alert(
      'Delete saved layout?',
      `"${layout.name}" will be removed from this device.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void removeLayout(layout),
        },
      ],
    );
  }

  function applyLayout(layout: LocalReportLayout) {
    const validSections = layout.sections.filter(
      (id): id is TSection => sections.some((section) => section.id === id),
    );
    onApply(validSections);
  }

  return (
    <View style={styles.container} testID={`${testID}-saved-layouts`}>
      <View style={styles.heading}>
        <Text style={[styles.headingText, { color: colors.mutedForeground }]}>
          My saved layouts
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save current report layout"
          testID={`${testID}-save-layout`}
          onPress={openSaveDialog}
          style={styles.saveButton}
        >
          <Ionicons name="add-circle-outline" size={15} color={colors.primary} />
          <Text style={[styles.saveButtonText, { color: colors.primary }]}>
            Save current
          </Text>
        </Pressable>
      </View>

      {layoutsQuery.isLoading ? (
        <Text style={[styles.message, { color: colors.mutedForeground }]}>
          Loading saved layouts…
        </Text>
      ) : layoutsQuery.isError ? (
        <Text style={[styles.error, { color: colors.destructive }]}>
          Could not load saved report layouts.
        </Text>
      ) : layouts.length === 0 ? (
        <Text style={[styles.message, { color: colors.mutedForeground }]}>
          Save a section combination to reuse it in this report.
        </Text>
      ) : (
        <View style={styles.layoutList}>
          {layouts.map((layout) => (
            <View
              key={layout.id}
              testID={`${testID}-saved-layout-${layout.id}`}
              style={[
                styles.layoutRow,
                { borderColor: colors.border, backgroundColor: colors.card },
              ]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Apply ${layout.name} report layout`}
                accessibilityHint="Replaces the selected report sections."
                testID={`${testID}-apply-layout-${layout.id}`}
                onPress={() => applyLayout(layout)}
                style={styles.applyButton}
              >
                <Text
                  numberOfLines={1}
                  style={[styles.layoutName, { color: colors.foreground }]}
                >
                  {layout.name}
                </Text>
                <Text style={[styles.layoutCount, { color: colors.mutedForeground }]}>
                  {layout.sections.length} sections
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Rename ${layout.name}`}
                testID={`${testID}-rename-layout-${layout.id}`}
                onPress={() => openRenameDialog(layout)}
                style={styles.iconButton}
                hitSlop={5}
              >
                <Ionicons
                  name="create-outline"
                  size={16}
                  color={colors.mutedForeground}
                />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete ${layout.name}`}
                testID={`${testID}-delete-layout-${layout.id}`}
                onPress={() => confirmDelete(layout)}
                style={styles.iconButton}
                hitSlop={5}
              >
                <Ionicons
                  name="trash-outline"
                  size={15}
                  color={colors.destructive}
                />
              </Pressable>
            </View>
          ))}
        </View>
      )}
      {layoutError ? (
        <Text style={[styles.error, { color: colors.destructive }]}>
          {layoutError}
        </Text>
      ) : null}

      <Modal
        visible={Boolean(layoutEditor)}
        transparent
        animationType="fade"
        onRequestClose={closeDialog}
      >
        <View style={styles.modalBackdrop}>
          <View
            accessibilityViewIsModal
            style={[
              styles.dialog,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.dialogTitle, { color: colors.foreground }]}>
              {layoutEditor?.mode === 'rename'
                ? 'Rename saved layout'
                : 'Save current layout'}
            </Text>
            <TextInput
              accessibilityLabel="Report layout name"
              testID={`${testID}-layout-name-input`}
              value={layoutName}
              onChangeText={(value) => {
                setLayoutName(value);
                setLayoutError('');
              }}
              onSubmitEditing={() => void saveLayout()}
              maxLength={40}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              placeholder="e.g. Coach review"
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.nameInput,
                {
                  color: colors.foreground,
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
            />
            {layoutError ? (
              <Text style={[styles.error, { color: colors.destructive }]}>
                {layoutError}
              </Text>
            ) : null}
            <View style={styles.dialogActions}>
              <Pressable
                accessibilityRole="button"
                testID={`${testID}-cancel-layout`}
                disabled={isSaving}
                onPress={closeDialog}
                style={[
                  styles.dialogButton,
                  { borderColor: colors.border, backgroundColor: colors.card },
                ]}
              >
                <Text style={[styles.cancelText, { color: colors.foreground }]}>
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                testID={`${testID}-confirm-layout`}
                disabled={isSaving}
                onPress={() => void saveLayout()}
                style={[
                  styles.dialogButton,
                  { borderColor: colors.primary, backgroundColor: colors.primary },
                ]}
              >
                <Text style={[styles.confirmText, { color: colors.primaryForeground }]}>
                  {isSaving ? 'Saving…' : layoutEditor?.mode === 'rename' ? 'Rename' : 'Save'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6 },
  heading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  headingText: { fontFamily: 'DMSans_700Bold', fontSize: 9 },
  saveButton: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  saveButtonText: { fontFamily: 'DMSans_700Bold', fontSize: 10 },
  message: { fontFamily: 'DMSans_400Regular', fontSize: 9 },
  error: { fontFamily: 'DMSans_500Medium', fontSize: 10 },
  layoutList: { gap: 5 },
  layoutRow: {
    minHeight: 43,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingLeft: 9,
    paddingRight: 3,
  },
  applyButton: { flex: 1, justifyContent: 'center', gap: 1, minHeight: 42 },
  layoutName: { fontFamily: 'DMSans_700Bold', fontSize: 10 },
  layoutCount: { fontFamily: 'DMSans_400Regular', fontSize: 8 },
  iconButton: {
    width: 34,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(15, 25, 22, 0.48)',
  },
  dialog: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 12 },
  dialogTitle: { fontFamily: 'Manrope_700Bold', fontSize: 16 },
  nameInput: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 11,
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
  },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  dialogButton: {
    minWidth: 84,
    minHeight: 38,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { fontFamily: 'DMSans_700Bold', fontSize: 11 },
  confirmText: { fontFamily: 'DMSans_700Bold', fontSize: 11 },
});
