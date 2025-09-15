import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useScan, DeviceMode } from '@/providers/scan-provider';

export default function DeviceModeGate() {
  const { flags, deviceMode, setDeviceMode, bind, isBound, activeAdapter } = useScan();
  const [ready, setReady] = useState<boolean>(false);

  useEffect(() => {
    if (!flags.scan.require_bound_adapter) {
      setReady(true);
      return;
    }
    bind().then(() => setReady(true));
  }, [flags.scan.require_bound_adapter, bind]);

  const needsSelection = useMemo(() => deviceMode === undefined || deviceMode === null, [deviceMode]);

  if (needsSelection) {
    return <DeviceModeSelector onSelect={async (m) => { await setDeviceMode(m); }} />;
  }

  if (!ready) {
    return (
      <View style={styles.block} testID="adapter-wait">
        <Text style={styles.title}>Preparing scanner…</Text>
        <Text style={styles.subtitle}>Binding adapter for {deviceMode}…</Text>
      </View>
    );
  }

  if (flags.scan.adapter_lock) {
    if (flags.scan.device_mode === 'skorpio-x5' && activeAdapter !== 'wedge') {
      return (
        <View style={styles.block} testID="adapter-missing">
          <Text style={styles.title}>Scanner not ready</Text>
          <Text style={styles.subtitle}>On Skorpio X5, the hardware scanner operates as a keyboard wedge. Focus an input field and scan.</Text>
        </View>
      );
    }
    if (flags.scan.device_mode === 'mobile-camera' && activeAdapter !== 'camera') {
      return (
        <View style={styles.block} testID="camera-permission-guard">
          <Text style={styles.title}>Camera required</Text>
          <Text style={styles.subtitle}>Enable camera permissions to scan.</Text>
        </View>
      );
    }
  }

  return null;
}

function DeviceModeSelector({ onSelect }: { onSelect: (m: DeviceMode) => void }) {
  return (
    <View style={styles.gate} testID="device-mode-selector">
      <Text style={styles.header}>Select Device Mode</Text>
      <Option label="Skorpio X5 (Hardware Scanner)" value="skorpio-x5" onPress={onSelect} />
      <Option label="Mobile (Phone/iPad Camera Scanner)" value="mobile-camera" onPress={onSelect} />
      <Option label="External/Bluetooth Scanner (Keystroke Wedge)" value="external-wedge" onPress={onSelect} />
    </View>
  );
}

function Option({ label, value, onPress }: { label: string; value: DeviceMode; onPress: (m: DeviceMode) => void }) {
  return (
    <TouchableOpacity style={styles.option} onPress={() => onPress(value)} testID={`mode-${value}`}>
      <Text style={styles.optionText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  gate: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0b1220',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 100,
  },
  header: {
    color: '#e5e7eb',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  option: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginTop: 12,
  },
  optionText: {
    color: '#f9fafb',
    fontSize: 16,
    fontWeight: '600',
  },
  block: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0b1220',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 90,
  },
  title: {
    color: '#e5e7eb',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#9ca3af',
    fontSize: 14,
  },
});
