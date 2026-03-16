/**
 * SettingsServerScreen — Configure which Gratonite server to connect to.
 * Non-technical friendly: "Connect to a different Gratonite server"
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../lib/theme';
import { getServerConfig, setServerConfig, testServerConnection, API_BASE } from '../../lib/api';
import PressableScale from '../../components/PressableScale';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<AppStackParamList, 'SettingsServer'>;

export default function SettingsServerScreen({ navigation }: Props) {
  const { colors, spacing, fontSize, borderRadius } = useTheme();
  const [serverUrl, setServerUrl] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; version?: string; error?: string } | null>(null);

  useEffect(() => {
    getServerConfig().then(config => {
      if (config.isCustom) {
        setServerUrl(config.apiBase.replace(/\/api\/v1\/?$/, ''));
        setIsCustom(true);
      }
    });
  }, []);

  const handleTest = async () => {
    if (!serverUrl.trim()) return;
    setTesting(true);
    setTestResult(null);
    const result = await testServerConnection(serverUrl.trim());
    setTestResult(result);
    setTesting(false);
  };

  const handleSave = async () => {
    if (!serverUrl.trim()) return;
    const result = await testServerConnection(serverUrl.trim());
    if (!result.ok) {
      Alert.alert('Connection Failed', result.error || 'Could not reach server');
      return;
    }
    await setServerConfig(serverUrl.trim());
    Alert.alert('Server Changed', 'You will need to sign in again on the new server.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  const handleReset = async () => {
    Alert.alert('Reset to Official Server', 'Switch back to gratonite.chat?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        onPress: async () => {
          await setServerConfig(null);
          setServerUrl('');
          setIsCustom(false);
          setTestResult(null);
        },
      },
    ]);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bgPrimary }]} contentContainerStyle={{ padding: spacing.md }}>
      <View style={[styles.card, { backgroundColor: colors.bgElevated, borderRadius: borderRadius.lg }]}>
        <Ionicons name="server-outline" size={48} color={colors.accentPrimary} style={styles.icon} />
        <Text style={[styles.title, { color: colors.textPrimary, fontSize: fontSize.lg }]}>
          Connect to a Gratonite Server
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary, fontSize: fontSize.sm }]}>
          {isCustom
            ? `Currently connected to a custom server`
            : 'You are connected to the official Gratonite server'}
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.bgElevated, borderRadius: borderRadius.lg, marginTop: spacing.md }]}>
        <Text style={[styles.label, { color: colors.textPrimary, fontSize: fontSize.sm }]}>Server URL</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.bgPrimary, color: colors.textPrimary, borderRadius: borderRadius.md, fontSize: fontSize.md }]}
          value={serverUrl}
          onChangeText={setServerUrl}
          placeholder="https://your-server.example.com"
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />

        <View style={styles.row}>
          <PressableScale
            onPress={handleTest}
            style={[styles.button, { backgroundColor: colors.accentPrimary + '20', borderRadius: borderRadius.md }]}
          >
            {testing ? (
              <ActivityIndicator color={colors.accentPrimary} size="small" />
            ) : (
              <>
                <Ionicons name="wifi-outline" size={18} color={colors.accentPrimary} />
                <Text style={[styles.buttonText, { color: colors.accentPrimary, fontSize: fontSize.sm }]}>Test Connection</Text>
              </>
            )}
          </PressableScale>

          <PressableScale
            onPress={handleSave}
            style={[styles.button, { backgroundColor: colors.accentPrimary, borderRadius: borderRadius.md }]}
          >
            <Ionicons name="checkmark-outline" size={18} color="#fff" />
            <Text style={[styles.buttonText, { color: '#fff', fontSize: fontSize.sm }]}>Connect</Text>
          </PressableScale>
        </View>

        {testResult && (
          <View style={[styles.result, { backgroundColor: testResult.ok ? colors.accentPrimary + '15' : '#ff000015', borderRadius: borderRadius.md }]}>
            <Ionicons
              name={testResult.ok ? 'checkmark-circle' : 'close-circle'}
              size={20}
              color={testResult.ok ? colors.accentPrimary : '#ff4444'}
            />
            <Text style={{ color: testResult.ok ? colors.accentPrimary : '#ff4444', marginLeft: 8, fontSize: fontSize.sm }}>
              {testResult.ok ? `Connected! Server v${testResult.version || 'unknown'}` : testResult.error}
            </Text>
          </View>
        )}
      </View>

      {isCustom && (
        <PressableScale
          onPress={handleReset}
          style={[styles.resetButton, { borderColor: colors.border, borderRadius: borderRadius.md, marginTop: spacing.md }]}
        >
          <Ionicons name="refresh-outline" size={18} color={colors.accentPrimary} />
          <Text style={[styles.buttonText, { color: colors.accentPrimary, fontSize: fontSize.sm }]}>
            Use Official Server
          </Text>
        </PressableScale>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: { padding: 20, alignItems: 'center' as const },
  icon: { marginBottom: 12 },
  title: { fontWeight: '700', textAlign: 'center' as const, marginBottom: 4 },
  subtitle: { textAlign: 'center' as const, marginBottom: 8 },
  label: { fontWeight: '600', alignSelf: 'flex-start' as const, marginBottom: 8 },
  input: { width: '100%' as any, padding: 12, marginBottom: 12 },
  row: { flexDirection: 'row' as const, gap: 8, width: '100%' as any },
  button: { flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, padding: 12, gap: 6 },
  buttonText: { fontWeight: '600' },
  result: { flexDirection: 'row' as const, alignItems: 'center' as const, padding: 12, marginTop: 8, width: '100%' as any },
  resetButton: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'center' as const, padding: 14, borderWidth: 1, gap: 6 },
});
