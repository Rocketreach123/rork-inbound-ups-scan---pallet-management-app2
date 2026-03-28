import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

interface BarcodeScannerViewProps {
  onScan: (data: string) => void;
}

export function BarcodeScannerView({ onScan }: BarcodeScannerViewProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Camera access is required to scan barcodes</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Camera Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    // Debounce same barcode for 2 seconds
    if (data === lastScanned) return;
    
    setLastScanned(data);
    onScan(data);
    
    // Reset after 2 seconds to allow rescanning
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setLastScanned(null);
    }, 2000) as any;
  };

  return (
    <View style={StyleSheet.absoluteFillObject}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={torchOn}
        onBarcodeScanned={handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: [
            'code128',
            'code39',
            'code93',
            'ean13',
            'ean8',
            'qr',
            'pdf417',
            'aztec',
            'datamatrix',
          ],
        }}
      />
      
      {/* Torch Control */}
      <View style={styles.torchOverlay}>
        <TouchableOpacity 
          style={[styles.torchButton, torchOn && styles.torchButtonOn]}
          onPress={() => {
            console.log('Torch button pressed, current state:', torchOn);
            setTorchOn((prev) => {
              const newState = !prev;
              console.log('Setting torch to:', newState);
              return newState;
            });
          }}
          testID="torch-toggle"
        >
          <Text style={styles.torchButtonText}>{torchOn ? '🔦 ON' : '🔦 OFF'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  message: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  torchOverlay: {
    position: 'absolute',
    bottom: 40,
    right: 20,
    zIndex: 10,
  },
  torchButton: {
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  torchButtonOn: {
    backgroundColor: '#f59e0b',
  },
  torchButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});