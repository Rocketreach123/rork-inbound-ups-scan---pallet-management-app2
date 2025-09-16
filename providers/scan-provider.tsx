import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Alert } from 'react-native';
import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type DeviceMode = 'skorpio-x5' | 'mobile-camera' | 'external-wedge';
export type Adapter = 'datalogic-sdk' | 'datalogic-intent' | 'wedge' | 'camera' | 'none';

interface ScanFlagsConfig {
  scan: {
    device_mode: DeviceMode | null;
    adapter_lock: boolean;
    require_bound_adapter: boolean;
    debounce_ms: number;
  };
  ui: {
    density: 'compact' | 'comfortable';
    high_contrast: boolean;
    show_camera_controls: boolean;
  };
}

interface ScanProviderState {
  deviceMode: DeviceMode | null;
  activeAdapter: Adapter;
  isBound: boolean;
  lastScanAt: number | null;
  flags: ScanFlagsConfig;
  setDeviceMode: (mode: DeviceMode) => Promise<void>;
  bind: () => Promise<void>;
  unbind: () => Promise<void>;
  onScan: (cb: (data: string) => void) => () => void;
}

const DEFAULT_FLAGS: ScanFlagsConfig = {
  scan: {
    device_mode: null,
    adapter_lock: true,
    require_bound_adapter: true,
    debounce_ms: 250,
  },
  ui: {
    density: 'compact',
    high_contrast: true,
    show_camera_controls: false,
  },
};

const STORAGE_KEY = 'scan.device_mode';

async function storageGet(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return window.localStorage.getItem(key);
    }
    const v = await AsyncStorage.getItem(key);
    return v;
  } catch (e) {
    console.log('storageGet failed', e);
    return null;
  }
}

async function storageSet(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      window.localStorage.setItem(key, value);
      return;
    }
    await AsyncStorage.setItem(key, value);
  } catch (e) {
    console.log('storageSet failed', e);
  }
}

export const [ScanProvider, useScan] = createContextHook<ScanProviderState>(() => {
  const listenersRef = useRef(new Set<(data: string) => void>());
  const [deviceMode, setDeviceModeState] = useState<DeviceMode | null>(null);
  const [activeAdapter, setActiveAdapter] = useState<Adapter>('none');
  const [isBound, setIsBound] = useState<boolean>(false);
  const [lastScanAt, setLastScanAt] = useState<number | null>(null);
  const [flags, setFlags] = useState<ScanFlagsConfig>(DEFAULT_FLAGS);

  useEffect(() => {
    (async () => {
      const stored = await storageGet(STORAGE_KEY);
      const initialMode: DeviceMode | null = (stored as DeviceMode) || null;
      const nextFlags: ScanFlagsConfig = {
        ...DEFAULT_FLAGS,
        scan: { ...DEFAULT_FLAGS.scan, device_mode: initialMode },
        ui: { ...DEFAULT_FLAGS.ui, show_camera_controls: initialMode === 'mobile-camera' || initialMode === 'skorpio-x5' },
      };
      setDeviceModeState(initialMode);
      setFlags(nextFlags);
    })();
  }, []);

  const setDeviceMode = useCallback(async (mode: DeviceMode) => {
    await storageSet(STORAGE_KEY, mode);
    const nextFlags: ScanFlagsConfig = {
      ...DEFAULT_FLAGS,
      scan: { ...DEFAULT_FLAGS.scan, device_mode: mode },
      ui: { ...DEFAULT_FLAGS.ui, show_camera_controls: mode === 'mobile-camera' || mode === 'skorpio-x5' },
    };
    setFlags(nextFlags);
    setDeviceModeState(mode);
    if (Platform.OS === 'web') {
      Alert.alert('Device Mode Changed', `Device Mode set to: ${mode === 'skorpio-x5' ? 'Skorpio X5 (Hardware Scanner Only)' : mode === 'mobile-camera' ? 'Mobile (Camera)' : 'External/Bluetooth Wedge'}`);
      // Small delay to ensure state is saved before reload
      setTimeout(() => window.location.reload(), 100);
    } else {
      // Mobile platforms should re-bind
      if (mode === 'mobile-camera' || mode === 'skorpio-x5') {
        setActiveAdapter('camera');
        setIsBound(true);
      }
    }
  }, []);

  const resolveAdapterForMode = useCallback((mode: DeviceMode | null): Adapter => {
    if (mode === 'mobile-camera') return 'camera';
    if (mode === 'external-wedge') return 'wedge';
    if (mode === 'skorpio-x5') return 'camera';
    return 'none';
  }, []);

  const bind = useCallback(async () => {
    setIsBound(false);
    const adapter = resolveAdapterForMode(deviceMode);
    setActiveAdapter(adapter);
    if ((deviceMode === 'mobile-camera' || deviceMode === 'skorpio-x5') && adapter === 'camera') {
      console.log('Binding camera adapter for', deviceMode);
    }
    setTimeout(() => setIsBound(true), 50);
  }, [deviceMode, resolveAdapterForMode]);

  const unbind = useCallback(async () => {
    setIsBound(false);
    setActiveAdapter('none');
  }, []);

  const onScan = useCallback((cb: (data: string) => void) => {
    listenersRef.current.add(cb);
    return () => listenersRef.current.delete(cb);
  }, []);

  const api: ScanProviderState = useMemo(() => ({
    deviceMode,
    activeAdapter,
    isBound,
    lastScanAt,
    flags,
    setDeviceMode,
    bind,
    unbind,
    onScan,
  }), [deviceMode, activeAdapter, isBound, lastScanAt, flags, setDeviceMode, bind, unbind, onScan]);

  return api;
});
