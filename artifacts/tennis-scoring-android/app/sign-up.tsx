import { useAuth, useSignUp, useSSO } from '@clerk/expo';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Link, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

WebBrowser.maybeCompleteAuthSession();

export default function SignUpScreen() {
  const colors = useColors();
  const router = useRouter();
  const { signUp, errors, fetchStatus } = useSignUp();
  const { isSignedIn } = useAuth();
  const { startSSOFlow } = useSSO();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isVerifying =
    signUp.status === 'missing_requirements' &&
    signUp.unverifiedFields.includes('email_address') &&
    signUp.missingFields.length === 0;

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);

  const finishSignUp = useCallback(async () => {
    await signUp.finalize({
      navigate: ({ decorateUrl }) => {
        router.replace(decorateUrl('/') as never);
      },
    });
  }, [router, signUp]);

  async function submitPassword() {
    setMessage('');
    setIsSubmitting(true);
    try {
      const { error } = await signUp.password({
        emailAddress: email.trim(),
        password,
      });
      if (error) {
        setMessage(error.longMessage || error.message);
        return;
      }
      await signUp.verifications.sendEmailCode();
      setMessage('Check your email for a verification code.');
    } catch {
      setMessage('Account could not be created. Please check your details and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function verifyCode() {
    setMessage('');
    setIsSubmitting(true);
    try {
      await signUp.verifications.verifyEmailCode({ code });
      if (signUp.status === 'complete') await finishSignUp();
      else setMessage('That code could not complete account verification.');
    } catch {
      setMessage('That verification code could not be confirmed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function signUpWithGoogle() {
    setMessage('');
    setIsSubmitting(true);
    try {
      const result = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: AuthSession.makeRedirectUri({ scheme: 'tennis-scoring-android' }),
      });
      if (result.createdSessionId) {
        await result.setActive?.({
          session: result.createdSessionId,
          navigate: ({ decorateUrl }) => {
            router.replace(decorateUrl('/') as never);
          },
        });
      } else {
        setMessage('Google sign-up needs another verification step.');
      }
    } catch {
      setMessage('Google sign-up could not be completed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSignedIn || signUp.status === 'complete') return null;
  const fieldError =
    errors.fields.emailAddress?.message || errors.fields.password?.message || errors.fields.code?.message;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <Text style={[styles.brandName, { color: colors.foreground }]}>
              Tennis<Text style={{ color: colors.primary }}>Scoring</Text>
            </Text>
            <Text style={[styles.eyebrow, { color: colors.accent }]}>
              PRIVATE MATCH NOTES
            </Text>
          </View>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              {isVerifying ? 'Verify your email' : 'Create your account'}
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {isVerifying
                ? 'Confirm your email before saving private match records.'
                : 'Your match book is private. You choose who can view it.'}
            </Text>

            {isVerifying ? (
              <TextInput
                accessibilityLabel="Email verification code"
                style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
                value={code}
                onChangeText={setCode}
                placeholder="Verification code"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="number-pad"
                autoComplete="one-time-code"
              />
            ) : (
              <>
                <TextInput
                  accessibilityLabel="Email address"
                  style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email address"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                />
                <TextInput
                  accessibilityLabel="Password"
                  style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Create a password"
                  placeholderTextColor={colors.mutedForeground}
                  secureTextEntry
                  autoComplete="new-password"
                />
              </>
            )}

            {fieldError ? <Text style={styles.error}>{fieldError}</Text> : null}
            {message ? (
              <Text style={[styles.message, { color: colors.mutedForeground }]}>{message}</Text>
            ) : null}

            <Pressable
              accessibilityRole="button"
              onPress={isVerifying ? verifyCode : submitPassword}
              disabled={isSubmitting || fetchStatus === 'fetching' || (!isVerifying && (!email || !password))}
              style={[
                styles.button,
                { backgroundColor: colors.primary, opacity: isSubmitting ? 0.65 : 1 },
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>
                  {isVerifying ? 'Verify email' : 'Create account'}
                </Text>
              )}
            </Pressable>

            {!isVerifying ? (
              <>
                <View style={styles.divider}>
                  <View style={[styles.line, { backgroundColor: colors.border }]} />
                  <Text style={[styles.or, { color: colors.mutedForeground }]}>OR</Text>
                  <View style={[styles.line, { backgroundColor: colors.border }]} />
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={signUpWithGoogle}
                  disabled={isSubmitting}
                  style={[styles.googleButton, { borderColor: colors.border }]}
                >
                  <Text style={[styles.googleButtonText, { color: colors.foreground }]}>
                    Continue with Google
                  </Text>
                </Pressable>
                <View style={styles.footer}>
                  <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
                    Already have an account?
                  </Text>
                  <Link href="/sign-in" asChild>
                    <Pressable><Text style={[styles.link, { color: colors.primary }]}>Sign in</Text></Pressable>
                  </Link>
                </View>
              </>
            ) : (
              <Pressable onPress={() => signUp.verifications.sendEmailCode()} style={styles.resend}>
                <Text style={[styles.link, { color: colors.primary }]}>Send a new code</Text>
              </Pressable>
            )}
            <View nativeID="clerk-captcha" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  brand: { alignItems: 'center', marginBottom: 25, gap: 6 },
  brandName: { fontFamily: 'Manrope_700Bold', fontSize: 23, letterSpacing: -0.8 },
  eyebrow: { fontFamily: 'DMSans_700Bold', fontSize: 9, letterSpacing: 1.5 },
  card: { borderWidth: 1, borderRadius: 16, padding: 22 },
  title: { fontFamily: 'Manrope_700Bold', fontSize: 23 },
  subtitle: { fontFamily: 'DMSans_400Regular', fontSize: 13, lineHeight: 19, marginTop: 7, marginBottom: 20 },
  input: { minHeight: 50, borderWidth: 1, borderRadius: 9, paddingHorizontal: 13, marginBottom: 11, fontFamily: 'DMSans_400Regular' },
  error: { color: '#b42318', fontFamily: 'DMSans_500Medium', fontSize: 12, marginBottom: 10 },
  message: { fontFamily: 'DMSans_400Regular', fontSize: 12, marginBottom: 10 },
  button: { minHeight: 50, borderRadius: 9, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  buttonText: { fontFamily: 'DMSans_700Bold', fontSize: 14 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 18 },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  or: { fontFamily: 'DMSans_700Bold', fontSize: 9, letterSpacing: 1.2 },
  googleButton: { minHeight: 48, borderWidth: 1, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  googleButtonText: { fontFamily: 'DMSans_600SemiBold', fontSize: 13 },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 18 },
  footerText: { fontFamily: 'DMSans_400Regular', fontSize: 12 },
  link: { fontFamily: 'DMSans_700Bold', fontSize: 12 },
  resend: { alignItems: 'center', paddingTop: 18 },
});
