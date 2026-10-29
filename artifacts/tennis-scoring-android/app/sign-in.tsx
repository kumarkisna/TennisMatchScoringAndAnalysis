import { useAuth, useSignIn, useSSO } from '@clerk/expo';
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

export default function SignInScreen() {
  const colors = useColors();
  const router = useRouter();
  const { signIn, errors, fetchStatus } = useSignIn();
  const { isSignedIn } = useAuth();
  const { startSSOFlow } = useSSO();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);

  const finishSignIn = useCallback(async () => {
    await signIn.finalize({
      navigate: ({ decorateUrl }) => {
        router.replace(decorateUrl('/') as never);
      },
    });
  }, [router, signIn]);

  async function submitPassword() {
    setMessage('');
    setIsSubmitting(true);
    try {
      const { error } = await signIn.password({
        emailAddress: email.trim(),
        password,
      });
      if (error) {
        setMessage(error.longMessage || error.message);
        return;
      }
      if (signIn.status === 'complete') {
        await finishSignIn();
      } else if (signIn.status === 'needs_client_trust') {
        await signIn.mfa.sendEmailCode();
        setMessage('Enter the verification code sent to your email.');
      } else {
        setMessage('This sign-in needs another verification step.');
      }
    } catch {
      setMessage('Sign-in could not be completed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function verifyCode() {
    setMessage('');
    setIsSubmitting(true);
    try {
      await signIn.mfa.verifyEmailCode({ code });
      if (signIn.status === 'complete') await finishSignIn();
      else setMessage('That code could not complete sign-in. Try again.');
    } catch {
      setMessage('That verification code could not be confirmed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function signInWithGoogle() {
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
        setMessage('Google sign-in needs another verification step.');
      }
    } catch {
      setMessage('Google sign-in could not be completed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSignedIn) return null;
  const isVerifying = signIn.status === 'needs_client_trust';
  const fieldError = errors.fields.identifier?.message || errors.fields.password?.message;

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
              {isVerifying ? 'Verify your account' : 'Welcome back'}
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {isVerifying
                ? 'Enter the email verification code to continue.'
                : 'Sign in to keep your match records private.'}
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
                  placeholder="Password"
                  placeholderTextColor={colors.mutedForeground}
                  secureTextEntry
                  autoComplete="current-password"
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
                  {isVerifying ? 'Verify and sign in' : 'Sign in'}
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
                  onPress={signInWithGoogle}
                  disabled={isSubmitting}
                  style={[styles.googleButton, { borderColor: colors.border }]}
                >
                  <Text style={[styles.googleButtonText, { color: colors.foreground }]}>
                    Continue with Google
                  </Text>
                </Pressable>
                <View style={styles.footer}>
                  <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
                    New to TennisScoring?
                  </Text>
                  <Link href="/sign-up" asChild>
                    <Pressable><Text style={[styles.link, { color: colors.primary }]}>Create account</Text></Pressable>
                  </Link>
                </View>
              </>
            ) : (
              <Pressable onPress={() => signIn.mfa.sendEmailCode()} style={styles.resend}>
                <Text style={[styles.link, { color: colors.primary }]}>Send a new code</Text>
              </Pressable>
            )}
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
