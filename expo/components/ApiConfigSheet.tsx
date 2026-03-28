import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Platform } from 'react-native';
import { Wifi, KeyRound, CheckCircle2, AlertTriangle } from 'lucide-react-native';
import { useApi } from '@/providers/api-provider';

export default function ApiConfigSheet() {
  const { config, setConfig, clearConfig, testConnection, isEnabled, isLoading, lastError } = useApi();
  const [baseUrl, setBaseUrl] = useState<string>(config.baseUrl ?? '');
  const [apiKey, setApiKey] = useState<string>(config.apiKey ?? '');
  const [testing, setTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message?: string } | null>(null);

  const canSave = useMemo(() => baseUrl.trim().length > 0, [baseUrl]);

  const onSave = async () => {
    await setConfig({ baseUrl: baseUrl.trim(), apiKey: apiKey.trim() || null });
  };

  const onClear = async () => {
    await clearConfig();
    setBaseUrl('');
    setApiKey('');
    setTestResult(null);
  };

  const onTest = async () => {
    try {
      setTesting(true);
      const res = await testConnection();
      setTestResult(res);
    } finally {
      setTesting(false);
    }
  };

  return (
    <View style={styles.container} testID="api-config-sheet">
      <Text style={styles.title}>API Connection</Text>

      <View style={styles.inputGroup}>
        <View style={styles.inputLabelRow}>
          <Wifi size={16} color="#6b7280" />
          <Text style={styles.inputLabel}>Base URL</Text>
        </View>
        <TextInput
          style={styles.input}
          placeholder="https://api.yourcompany.com"
          value={baseUrl}
          onChangeText={setBaseUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType={Platform.OS === 'web' ? 'default' : 'url'}
          testID="api-base-url"
        />
      </View>

      <View style={styles.inputGroup}>
        <View style={styles.inputLabelRow}>
          <KeyRound size={16} color="#6b7280" />
          <Text style={styles.inputLabel}>API Key (optional)</Text>
        </View>
        <TextInput
          style={styles.input}
          placeholder="sk_..."
          value={apiKey}
          onChangeText={setApiKey}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          testID="api-key"
        />
      </View>

      {testResult && (
        <View style={[styles.testBanner, { backgroundColor: testResult.ok ? '#ecfdf5' : '#fef2f2', borderColor: testResult.ok ? '#10b981' : '#ef4444' }]}>
          {testResult.ok ? <CheckCircle2 size={18} color="#10b981" /> : <AlertTriangle size={18} color="#ef4444" />}
          <Text style={[styles.testText, { color: testResult.ok ? '#065f46' : '#991b1b' }]}>{testResult.message ?? (testResult.ok ? 'Connected' : 'Failed')}</Text>
        </View>
      )}

      {lastError && (
        <Text style={styles.errorText}>{lastError}</Text>
      )}

      <View style={styles.row}>
        <TouchableOpacity style={[styles.button, styles.secondary]} onPress={onTest} disabled={testing || !canSave} testID="api-test">
          <Text style={[styles.buttonText, styles.secondaryText]}>{testing ? 'Testing...' : 'Test'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, canSave ? styles.primary : styles.disabled]} onPress={onSave} disabled={!canSave} testID="api-save">
          <Text style={styles.buttonText}>Save</Text>
        </TouchableOpacity>
      </View>

      {isEnabled && (
        <TouchableOpacity style={[styles.button, styles.danger]} onPress={onClear} testID="api-clear">
          <Text style={styles.buttonText}>Clear</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  inputLabel: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  button: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: '#1e40af' },
  disabled: { backgroundColor: '#93c5fd' },
  secondary: { backgroundColor: '#e5e7eb' },
  danger: { backgroundColor: '#ef4444', marginTop: 12 },
  buttonText: { color: '#fff', fontWeight: '700' },
  secondaryText: { color: '#111827', fontWeight: '700' },
  testBanner: {
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
  },
  testText: { fontSize: 13 },
  errorText: { color: '#ef4444', marginTop: 6 },
});
