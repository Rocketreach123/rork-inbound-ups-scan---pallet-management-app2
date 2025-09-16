import { useEffect, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import { useScan } from '@/providers/scan-provider';
import { useWarehouse } from '@/providers/warehouse-provider';
import { useRouter, usePathname } from 'expo-router';

export function GlobalBarcodeListener() {
  const { deviceMode, onScan } = useScan();
  const { processPackageScan, matchPalletCodeFromScan, setActivePalletByCode } = useWarehouse();
  const router = useRouter();
  const pathname = usePathname();
  const processingRef = useRef(false);
  const lastScanRef = useRef<string>('');
  const lastScanTimeRef = useRef<number>(0);

  useEffect(() => {
    // Only activate for Skorpio X5 hardware scanner
    if (deviceMode !== 'skorpio-x5') {
      console.log('[GlobalBarcode] Not in Skorpio X5 mode, skipping');
      return;
    }

    console.log('[GlobalBarcode] Setting up listener for Skorpio X5 on path:', pathname);

    const handleGlobalScan = async (data: string) => {
      // Debounce duplicate scans
      const now = Date.now();
      if (data === lastScanRef.current && now - lastScanTimeRef.current < 2000) {
        console.log('[GlobalBarcode] Duplicate scan ignored:', data);
        return;
      }

      lastScanRef.current = data;
      lastScanTimeRef.current = now;

      // Prevent concurrent processing
      if (processingRef.current) {
        console.log('[GlobalBarcode] Already processing, skipping:', data);
        return;
      }

      processingRef.current = true;
      console.log('[GlobalBarcode] Processing scan:', data, 'on path:', pathname);

      try {
        // Check if it's a pallet code
        const palletCode = matchPalletCodeFromScan(data);
        if (palletCode) {
          console.log('[GlobalBarcode] Detected pallet code:', palletCode);
          const success = await setActivePalletByCode(palletCode);
          if (success) {
            Alert.alert(
              'Pallet Activated',
              `Active pallet set to: ${palletCode}`,
              [{ text: 'OK' }]
            );
          } else {
            Alert.alert(
              'Pallet Not Found',
              `No pallet found with code: ${palletCode}`,
              [{ text: 'OK' }]
            );
          }
        } else {
          // It's a package tracking number
          console.log('[GlobalBarcode] Processing as package:', data);
          
          // Navigate to operations tab if not already there
          if (!pathname.includes('operations') && !pathname.includes('scan')) {
            console.log('[GlobalBarcode] Navigating to operations');
            router.push('/(tabs)/operations');
          }

          // Process the package scan
          const result = await processPackageScan(data);
          
          if (result.apiMatched) {
            Alert.alert(
              'Package Scanned',
              `Tracking: ${result.package?.tracking}\nPO: ${result.po?.poNumber}\nPallet: ${result.suggestedPallet?.palletCode}`,
              [{ text: 'OK' }]
            );
          } else {
            Alert.alert(
              'Package Not Found',
              `Package moved to unmatched pallet.\nTracking: ${data}`,
              [{ text: 'OK' }]
            );
          }
        }
      } catch (error: any) {
        console.error('[GlobalBarcode] Error processing scan:', error);
        Alert.alert(
          'Scan Error',
          `Failed to process: ${error.message}`,
          [{ text: 'OK' }]
        );
      } finally {
        processingRef.current = false;
      }
    };

    // Register the global scan handler
    const unsubscribe = onScan(handleGlobalScan);

    // Create a hidden input to capture wedge scanner input
    if (Platform.OS === 'web') {
      // For web, create a hidden input that's always focused
      const hiddenInput = document.createElement('input');
      hiddenInput.style.position = 'absolute';
      hiddenInput.style.left = '-9999px';
      hiddenInput.style.top = '-9999px';
      hiddenInput.setAttribute('autocomplete', 'off');
      document.body.appendChild(hiddenInput);

      let buffer = '';
      let bufferTimer: ReturnType<typeof setTimeout>;

      const handleKeyPress = (e: KeyboardEvent) => {
        // Check if an actual input is focused
        const activeElement = document.activeElement;
        if (activeElement && activeElement.tagName === 'INPUT' && activeElement !== hiddenInput) {
          return; // Let the actual input handle it
        }

        // Capture barcode scanner input
        if (e.key === 'Enter') {
          if (buffer.length > 0) {
            handleGlobalScan(buffer);
            buffer = '';
          }
        } else if (e.key.length === 1) {
          buffer += e.key;
          clearTimeout(bufferTimer);
          bufferTimer = setTimeout(() => {
            buffer = '';
          }, 100); // Clear buffer after 100ms of inactivity
        }
      };

      document.addEventListener('keypress', handleKeyPress);

      // Keep hidden input focused when nothing else is
      const focusInterval = setInterval(() => {
        const activeElement = document.activeElement;
        if (!activeElement || activeElement === document.body) {
          hiddenInput.focus();
        }
      }, 500);

      return () => {
        unsubscribe();
        document.removeEventListener('keypress', handleKeyPress);
        clearInterval(focusInterval);
        clearTimeout(bufferTimer);
        document.body.removeChild(hiddenInput);
      };
    }

    return unsubscribe;
  }, [
    deviceMode,
    pathname,
    onScan,
    processPackageScan,
    matchPalletCodeFromScan,
    setActivePalletByCode,
    router
  ]);

  // No UI - this is just a listener
  return null;
}