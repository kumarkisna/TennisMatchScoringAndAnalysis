import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  type ScrollViewInstance,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBar } from '@/components/BottomTabBar';
import { useColors } from '@/hooks/useColors';
import {
  APP_GUIDE_SECTIONS,
  type AppGuideSectionId,
} from '@/lib/app-guide';
import {
  APP_BRAND_NAME,
  APP_COPYRIGHT_NOTICE,
} from '@/lib/branding';
import { buildAppGuidePrintHtml } from '@/lib/app-guide-print';
import { listLocalMatches, LOCAL_MATCH_LIST_KEY } from '@/lib/local-matches';
import { splitHomeMatches } from '@/lib/home-screen-state';
import { createAndPreviewLocalPdf } from '@/lib/report-pdf';

export default function AboutScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollViewInstance | null>(null);
  const sectionOffsets = useRef<Partial<Record<AppGuideSectionId, number>>>({});
  const [isPrinting, setIsPrinting] = useState(false);
  const matchesQuery = useQuery({
    queryKey: LOCAL_MATCH_LIST_KEY,
    queryFn: listLocalMatches,
  });
  const historyCount = splitHomeMatches(matchesQuery.data ?? []).history.length;

  const jumpToSection = (id: AppGuideSectionId) => {
    const sectionOffset = sectionOffsets.current[id];
    if (sectionOffset === undefined) return;
    scrollRef.current?.scrollTo({
      y: Math.max(sectionOffset - 12, 0),
      animated: true,
    });
  };

  const printAllInstructions = async () => {
    if (isPrinting) return;
    setIsPrinting(true);
    try {
      await createAndPreviewLocalPdf(
        buildAppGuidePrintHtml(),
        Platform.OS,
        Print,
      );
    } catch (error) {
      Alert.alert(
        'Could not open print options',
        error instanceof Error
          ? error.message
          : 'Please try printing the guide again.',
      );
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 20) + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text selectable={false} style={[styles.eyebrow, { color: colors.primary }]}>
            APP INFO & HELP
          </Text>
          <Text selectable={false} style={[styles.pageTitle, { color: colors.foreground }]}>
            About {APP_BRAND_NAME}
          </Text>
          <Text selectable={false} style={[styles.pageSubtitle, { color: colors.mutedForeground }]}>
            A practical guide to recording matches and reviewing player performance.
          </Text>
        </View>

        <View
          style={[
            styles.brandCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View
            style={[
              styles.brandMark,
              { backgroundColor: colors.primary + '18' },
            ]}
          >
            <Ionicons name="tennisball-outline" size={25} color={colors.primary} />
          </View>
          <View style={styles.brandCopy}>
            <Text selectable={false} style={[styles.brandName, { color: colors.foreground }]}>
              {APP_BRAND_NAME}
            </Text>
            <Text selectable={false} style={[styles.copyright, { color: colors.mutedForeground }]}>
              {APP_COPYRIGHT_NOTICE}
            </Text>
            <Text selectable={false} style={[styles.localNote, { color: colors.mutedForeground }]}>
              Match and player records stay on this device.
            </Text>
          </View>
        </View>

        <Pressable
          testID="button-print-all-about"
          accessibilityRole="button"
          accessibilityLabel="Print all About instructions"
          accessibilityHint="Opens print options for the complete guide. You can print it or save it as a PDF."
          accessibilityState={{ disabled: isPrinting, busy: isPrinting }}
          disabled={isPrinting}
          onPress={() => void printAllInstructions()}
          style={({ pressed }) => [
            styles.printButton,
            {
              backgroundColor: colors.primary,
              opacity: isPrinting ? 0.75 : pressed ? 0.82 : 1,
            },
          ]}
        >
          {isPrinting ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <Ionicons
              name="print-outline"
              size={18}
              color={colors.primaryForeground}
            />
          )}
          <Text
            selectable={false}
            style={[styles.printButtonText, { color: colors.primaryForeground }]}
          >
            {isPrinting ? 'Preparing print…' : 'Print all instructions'}
          </Text>
        </Pressable>

        <View style={styles.contentsBlock}>
          <View style={styles.contentsHeading}>
            <Text selectable={false} style={[styles.sectionHeading, { color: colors.foreground }]}>
              How to use the app
            </Text>
            <Text selectable={false} style={[styles.contentsHint, { color: colors.mutedForeground }]}>
              Tap a topic to jump to its instructions.
            </Text>
          </View>
          <View style={styles.topicGrid}>
            {APP_GUIDE_SECTIONS.map((section) => (
              <Pressable
                key={section.id}
                testID={`about-jump-${section.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Jump to ${section.navLabel} instructions`}
                onPress={() => jumpToSection(section.id)}
                style={({ pressed }) => [
                  styles.topicButton,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    opacity: pressed ? 0.72 : 1,
                  },
                ]}
              >
                <Ionicons
                  name={section.icon}
                  size={17}
                  color={colors.primary}
                />
                <Text
                  selectable={false}
                  numberOfLines={1}
                  style={[styles.topicLabel, { color: colors.foreground }]}
                >
                  {section.navLabel}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={14}
                  color={colors.mutedForeground}
                />
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.guideSections}>
          {APP_GUIDE_SECTIONS.map((section, sectionIndex) => (
            <View
              key={section.id}
              testID={`about-section-${section.id}`}
              onLayout={(event) => {
                sectionOffsets.current[section.id] = event.nativeEvent.layout.y;
              }}
              style={[
                styles.guideCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.guideTitleRow}>
                <View
                  style={[
                    styles.guideIcon,
                    { backgroundColor: colors.primary + '18' },
                  ]}
                >
                  <Ionicons
                    name={section.icon}
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.guideTitleCopy}>
                  <Text selectable={false} style={[styles.guideEyebrow, { color: colors.primary }]}>
                    {String(sectionIndex + 1).padStart(2, '0')}
                  </Text>
                  <Text selectable={false} style={[styles.guideTitle, { color: colors.foreground }]}>
                    {section.title}
                  </Text>
                </View>
              </View>
              <Text selectable={false} style={[styles.guideIntro, { color: colors.mutedForeground }]}>
                {section.intro}
              </Text>
              <View style={styles.steps}>
                {section.steps.map((step, stepIndex) => (
                  <View key={`${section.id}-step-${stepIndex}`} style={styles.stepRow}>
                    <View
                      style={[
                        styles.stepNumber,
                        { backgroundColor: colors.background, borderColor: colors.border },
                      ]}
                    >
                      <Text selectable={false} style={[styles.stepNumberText, { color: colors.primary }]}>
                        {stepIndex + 1}
                      </Text>
                    </View>
                    <Text selectable={false} style={[styles.stepText, { color: colors.foreground }]}>
                      {step}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
      <BottomTabBar activeTab="about" historyCount={historyCount} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 18, gap: 20 },
  header: { gap: 5 },
  eyebrow: { fontFamily: 'DMSans_700Bold', fontSize: 10, letterSpacing: 1.2 },
  pageTitle: { fontFamily: 'Manrope_700Bold', fontSize: 27, lineHeight: 33 },
  pageSubtitle: { fontFamily: 'DMSans_400Regular', fontSize: 13, lineHeight: 19 },
  brandCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 17,
    padding: 15,
  },
  brandMark: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandCopy: { flex: 1, gap: 3 },
  brandName: { fontFamily: 'Manrope_700Bold', fontSize: 17 },
  copyright: { fontFamily: 'DMSans_500Medium', fontSize: 10, lineHeight: 14 },
  localNote: { fontFamily: 'DMSans_400Regular', fontSize: 10, lineHeight: 14 },
  contentsBlock: { gap: 11 },
  contentsHeading: { gap: 3 },
  sectionHeading: { fontFamily: 'Manrope_700Bold', fontSize: 18 },
  contentsHint: { fontFamily: 'DMSans_400Regular', fontSize: 11 },
  printButton: {
    minHeight: 48,
    borderRadius: 13,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  printButtonText: { fontFamily: 'DMSans_700Bold', fontSize: 13 },
  topicGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  topicButton: {
    flexBasis: '47%',
    flexGrow: 1,
    minWidth: 142,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  topicLabel: { flex: 1, fontFamily: 'DMSans_600SemiBold', fontSize: 11 },
  guideSections: { gap: 12 },
  guideCard: { borderWidth: 1, borderRadius: 17, padding: 15, gap: 12 },
  guideTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  guideIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideTitleCopy: { flex: 1, gap: 1 },
  guideEyebrow: { fontFamily: 'DMSans_700Bold', fontSize: 9, letterSpacing: 0.8 },
  guideTitle: { fontFamily: 'Manrope_700Bold', fontSize: 16, lineHeight: 21 },
  guideIntro: { fontFamily: 'DMSans_400Regular', fontSize: 12, lineHeight: 18 },
  steps: { gap: 10 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  stepNumber: {
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumberText: { fontFamily: 'DMSans_700Bold', fontSize: 10 },
  stepText: { flex: 1, fontFamily: 'DMSans_400Regular', fontSize: 12, lineHeight: 19 },
});
