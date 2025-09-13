import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, Platform } from 'react-native';
import { Package, MapPin, Check, ArrowRight } from 'lucide-react-native';
import { router } from 'expo-router';
import { useWarehouse } from '@/providers/warehouse-provider';
import { BarcodeScannerView } from '@/components/BarcodeScanner';

type ScanMode = 'pallet' | 'location' | 'complete';

export default function MovePalletScreen() {
  const [scanMode, setScanMode] = useState<ScanMode>('pallet');
  const [palletCode, setPalletCode] = useState<string | null>(null);
  const [locationCode, setLocationCode] = useState<string | null>(null);
  const { movePallet } = useWarehouse();

  const handleScan = async (data: string) => {
    console.log(`Scanned ${scanMode}:`, data);
    
    if (scanMode === 'pallet') {
      if (/^(PAL|LP)[:\-]/i.test(data) || /^(LP\d{6})$/i.test(data)) {
        setPalletCode(data.replace(/^(PAL|LP)[:\-]/i, ''));
        setScanMode('location');
      } else {
        Alert.alert('Invalid Scan', 'Please scan a valid pallet barcode');
      }
    } else if (scanMode === 'location') {
      if (data.startsWith('LOC:') || data.includes('LOC-')) {
        setLocationCode(data.replace('LOC:', ''));
        setScanMode('complete');
        await completeMove();
      } else {
        Alert.alert('Invalid Scan', 'Please scan a valid location barcode');
      }
    }
  };

  const completeMove = async () => {
    if (!palletCode || !locationCode) return;
    
    const success = await movePallet(palletCode, locationCode);
    if (success) {
      Alert.alert(
        'Success',
        `Pallet ${palletCode} moved to ${locationCode}`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    }
  };

  const reset = () => {
    setPalletCode(null);
    setLocationCode(null);
    setScanMode('pallet');
  };

  if (scanMode === 'complete') {
    return (
      <View style={styles.container}>
        <View style={styles.completeCard}>
          <View style={styles.successIcon}>
            <Check color="#10b981" size={48} />
          </View>
          
          <Text style={styles.successTitle}>Move Complete</Text>
          
          <View style={styles.moveDetails}>
            <View style={styles.moveItem}>
              <Package color="#6b7280" size={20} />
              <View style={styles.moveItemContent}>
                <Text style={styles.moveLabel}>Pallet</Text>
                <Text style={styles.moveValue}>{palletCode}</Text>
              </View>
            </View>
            
            <ArrowRight color="#9ca3af" size={24} style={styles.arrow} />
            
            <View style={styles.moveItem}>
              <MapPin color="#6b7280" size={20} />
              <View style={styles.moveItemContent}>
                <Text style={styles.moveLabel}>Location</Text>
                <Text style={styles.moveValue}>{locationCode}</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.actions}>
            <TouchableOpacity 
              style={styles.primaryButton}
              onPress={() => router.back()}
            >
              <Text style={styles.primaryButtonText}>Done</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.secondaryButton}
              onPress={reset}
            >
              <Text style={styles.secondaryButtonText}>Move Another</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BarcodeScannerView onScan={handleScan} />
      
      <View style={styles.overlay}>
        <View style={styles.scanFrame}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>
        
        <View style={styles.instructions}>
          {scanMode === 'pallet' ? (
            <>
              <Package color="#fff" size={32} />
              <Text style={styles.instructionText}>Scan Pallet Barcode</Text>
              <Text style={styles.instructionSubtext}>
                Position the pallet label within the frame
              </Text>
            </>
          ) : (
            <>
              <MapPin color="#fff" size={32} />
              <Text style={styles.instructionText}>Scan Location Barcode</Text>
              <Text style={styles.instructionSubtext}>
                Position the location label within the frame
              </Text>
            </>
          )}
        </View>

        {palletCode && (
          <View style={styles.statusBar}>
            <Text style={styles.statusText}>
              Pallet: {palletCode}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: 280,
    height: 280,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#f59e0b',
    borderWidth: 3,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  instructions: {
    position: 'absolute',
    bottom: 100,
    alignItems: 'center',
  },
  instructionText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  instructionSubtext: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 4,
  },
  statusBar: {
    position: 'absolute',
    top: 100,
    backgroundColor: 'rgba(30, 64, 175, 0.9)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  completeCard: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  successIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 32,
  },
  moveDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 32,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  moveItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  moveItemContent: {
    alignItems: 'center',
  },
  moveLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  moveValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  arrow: {
    marginHorizontal: 16,
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  secondaryButtonText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '600',
  },
});