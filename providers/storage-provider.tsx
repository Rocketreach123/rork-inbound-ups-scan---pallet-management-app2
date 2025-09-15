import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';

export type Storage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const webGet = async (key: string): Promise<string | null> => {
  try {
    if (Platform.OS === 'web') return window.localStorage.getItem(key);
  } catch (e) {
    console.warn('[storage] web get error', e);
  }
  return AsyncStorage.getItem(key);
};

const webSet = async (key: string, value: string): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      window.localStorage.setItem(key, value);
      return;
    }
  } catch (e) {
    console.warn('[storage] web set error', e);
  }
  await AsyncStorage.setItem(key, value);
};

const webRemove = async (key: string): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      window.localStorage.removeItem(key);
      return;
    }
  } catch (e) {
    console.warn('[storage] web remove error', e);
  }
  await AsyncStorage.removeItem(key);
};

export const [StorageProvider, useStorage] = createContextHook<Storage>(() => ({
  getItem: webGet,
  setItem: webSet,
  removeItem: webRemove,
}));
