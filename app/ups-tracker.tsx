import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Alert,
  ActivityIndicator,
  Platform,
  TextInput,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { ArrowLeft, Package, ExternalLink, History, Scan } from 'lucide-react-native';

import { EnhancedBarcodeScanner } from '@/components/EnhancedBarcodeScanner';

interface TrackingHistory {
  trackingNumber: string;
  timestamp: Date;
}
import { useScan } from '@/providers/scan-provider';

export default function UPSTracker() {
  const [isScanning, setIsScanning] = useState(false);
  const [currentTracking, setCurrentTracking] = useState<string>('');
  const [history, setHistory] = useState<TrackingHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { deviceMode } = useScan();


  const validateUPSTrackingNumber = (trackingNumber: string): boolean => {
    // UPS tracking number formats:
    // 1Z: Standard ground/air tracking (18 characters total)
    // T: UPS Mail Innovations (starts with T, followed by 10 digits)
    // K: UPS Next Day Air (starts with K, followed by 10 digits)
    // Also check for UPS WorldShip numbers (starts with 1Z and has specific format)
    
    const cleaned = trackingNumber.trim().toUpperCase();
    
    // Standard UPS tracking: 1Z + 6 chars (shipper number) + 2 chars (service) + 8 digits (package ID)
    const standard1ZPattern = /^1Z[A-Z0-9]{6}[0-9]{2}[0-9]{8}$/;
    
    // Alternative 1Z format with different structure
    const alt1ZPattern = /^1Z[A-Z0-9]{16}$/;
    
    // UPS Mail Innovations
    const mailInnovationsPattern = /^T[0-9]{10}$/;
    
    // UPS Next Day Air  
    const nextDayAirPattern = /^K[0-9]{10}$/;
    
    // UPS WorldShip (numeric only, 18 digits)
    const worldShipPattern = /^[0-9]{18}$/;
    
    // Additional UPS formats
    const upsGroundFreightPattern = /^H[0-9]{10}$/;
    const upsSurePostPattern = /^92[0-9]{20}$/;
    
    return (
      standard1ZPattern.test(cleaned) ||
      alt1ZPattern.test(cleaned) ||
      mailInnovationsPattern.test(cleaned) ||
      nextDayAirPattern.test(cleaned) ||
      worldShipPattern.test(cleaned) ||
      upsGroundFreightPattern.test(cleaned) ||
      upsSurePostPattern.test(cleaned)
    );
  };

  const handleBarcodeScan = useCallback((data: string) => {
    console.log('Scanned barcode:', data);
    
    // Clean up the scanned data
    let trackingNumber = data.trim().toUpperCase();
    
    // First, check if the entire scanned data is a valid UPS tracking number
    if (validateUPSTrackingNumber(trackingNumber)) {
      console.log('Valid UPS tracking number detected:', trackingNumber);
    } else {
      // Try to extract a UPS tracking number from the barcode data
      // Sometimes barcodes contain additional data
      
      // Try to find standard 1Z format
      const standard1ZMatch = data.match(/1Z[A-Z0-9]{16}/i);
      if (standard1ZMatch && validateUPSTrackingNumber(standard1ZMatch[0])) {
        trackingNumber = standard1ZMatch[0].toUpperCase();
        console.log('Extracted valid 1Z tracking number:', trackingNumber);
      } else {
        // Try other UPS formats
        const patterns = [
          /T[0-9]{10}/i,  // Mail Innovations
          /K[0-9]{10}/i,  // Next Day Air
          /H[0-9]{10}/i,  // Ground Freight
          /92[0-9]{20}/,  // SurePost
          /[0-9]{18}/     // WorldShip
        ];
        
        let found = false;
        for (const pattern of patterns) {
          const match = data.match(pattern);
          if (match && validateUPSTrackingNumber(match[0])) {
            trackingNumber = match[0].toUpperCase();
            console.log('Extracted valid UPS tracking number:', trackingNumber);
            found = true;
            break;
          }
        }
        
        if (!found) {
          console.log('Not a UPS tracking number:', data);
          Alert.alert(
            'Not a UPS Package',
            'This barcode does not contain a valid UPS tracking number. Please scan a UPS package label.',
            [
              { text: 'Cancel', onPress: () => setIsScanning(false), style: 'cancel' },
              { text: 'Try Again', onPress: () => setIsScanning(true) }
            ]
          );
          setIsScanning(false);
          return;
        }
      }
    }
    
    setCurrentTracking(trackingNumber);
    setIsScanning(false);
    
    // Add to history
    const newHistory: TrackingHistory = {
      trackingNumber,
      timestamp: new Date(),
    };
    setHistory(prev => [newHistory, ...prev.filter(h => h.trackingNumber !== trackingNumber).slice(0, 9)]);
    
    // Open UPS tracking page
    openTrackingPage(trackingNumber);
  }, []);

  const openTrackingPage = (trackingNumber: string) => {
    setIsLoading(true);
    const url = `https://www.ups.com/track?loc=en_US&tracknum=${trackingNumber}`;
    
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(url);
        } else {
          Alert.alert('Error', 'Cannot open UPS tracking page');
        }
      })
      .catch((err) => {
        console.error('Error opening URL:', err);
        Alert.alert('Error', 'Failed to open tracking page');
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const handleHistoryItemPress = (item: TrackingHistory) => {
    setCurrentTracking(item.trackingNumber);
    openTrackingPage(item.trackingNumber);
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  if (isScanning) {
    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Scan UPS Package',
            headerLeft: () => (
              <TouchableOpacity
                onPress={() => setIsScanning(false)}
                style={styles.headerButton}
              >
                <ArrowLeft size={24} color="#007AFF" />
              </TouchableOpacity>
            ),
          }}
        />
        {deviceMode === 'mobile-camera' ? (
          <EnhancedBarcodeScanner onScan={handleBarcodeScan} />
        ) : (
          <View style={styles.wedgeContainer}>
            <Text style={styles.wedgeInfoText}>
              Hardware scanner mode. Focus the field and scan a UPS tracking barcode.
            </Text>
            <TouchableOpacity
              onPress={() => {}}
              activeOpacity={1}
              style={styles.wedgeTouch}
            >
              <TextInput
                style={styles.wedgeInput}
                autoFocus
                blurOnSubmit={false}
                onSubmitEditing={({ nativeEvent }: { nativeEvent: { text?: string } }) => {
                  const val = (nativeEvent?.text ?? '').trim().toUpperCase();
                  if (val) handleBarcodeScan(val);
                }}
                placeholder="Scan here"
                placeholderTextColor="#9ca3af"
                testID="ups-wedge-input"
              />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'UPS Package Tracker',
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.headerButton}
            >
              <ArrowLeft size={24} color="#007AFF" />
            </TouchableOpacity>
          ),
        }}
      />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Current Tracking */}
        {currentTracking ? (
          <View style={styles.currentCard}>
            <View style={styles.currentHeader}>
              <Package size={24} color="#8B4513" />
              <Text style={styles.currentTitle}>Current Package</Text>
            </View>
            <Text style={styles.trackingNumber}>{currentTracking}</Text>
            <TouchableOpacity
              style={styles.trackButton}
              onPress={() => openTrackingPage(currentTracking)}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <ExternalLink size={20} color="#FFF" />
                  <Text style={styles.trackButtonText}>Open Tracking Page</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Scan Button */}
        <TouchableOpacity
          style={styles.scanButton}
          onPress={() => setIsScanning(true)}
        >
          <Scan size={24} color="#FFF" />
          <Text style={styles.scanButtonText}>
            {currentTracking ? 'Scan Another Package' : 'Scan UPS Package'}
          </Text>
        </TouchableOpacity>

        {/* History */}
        {history.length > 0 && (
          <View style={styles.historySection}>
            <View style={styles.historyHeader}>
              <History size={20} color="#666" />
              <Text style={styles.historyTitle}>Recent Scans</Text>
            </View>
            {history.map((item, index) => (
              <TouchableOpacity
                key={`${item.trackingNumber}-${index}`}
                style={styles.historyItem}
                onPress={() => handleHistoryItemPress(item)}
              >
                <View style={styles.historyItemContent}>
                  <Text style={styles.historyTracking}>{item.trackingNumber}</Text>
                  <Text style={styles.historyTime}>{formatTimestamp(item.timestamp)}</Text>
                </View>
                <ExternalLink size={16} color="#999" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionTitle}>How to use:</Text>
          <Text style={styles.instructionText}>1. Tap &quot;Scan UPS Package&quot; to scan a barcode</Text>
          <Text style={styles.instructionText}>2. Only valid UPS tracking numbers will be accepted</Text>
          <Text style={styles.instructionText}>3. The UPS tracking page will open automatically</Text>
          <Text style={styles.instructionText}>4. Use your browser&apos;s back button to return here</Text>
          <Text style={styles.instructionText}>5. Scan another package or view recent scans</Text>
        </View>
        
        {/* Supported Formats */}
        <View style={styles.formats}>
          <Text style={styles.formatTitle}>Supported UPS Formats:</Text>
          <Text style={styles.formatText}>• Standard: 1Z + 16 characters</Text>
          <Text style={styles.formatText}>• Mail Innovations: T + 10 digits</Text>
          <Text style={styles.formatText}>• Next Day Air: K + 10 digits</Text>
          <Text style={styles.formatText}>• Ground Freight: H + 10 digits</Text>
          <Text style={styles.formatText}>• SurePost: 92 + 20 digits</Text>
          <Text style={styles.formatText}>• WorldShip: 18 digits</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  headerButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  currentCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  currentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  currentTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  trackingNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#8B4513',
    marginBottom: 16,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  trackButton: {
    backgroundColor: '#8B4513',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
    gap: 8,
  },
  trackButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  scanButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  scanButtonText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  historySection: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginLeft: 8,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  historyItemContent: {
    flex: 1,
  },
  historyTracking: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  historyTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  instructions: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  instructionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  instructionText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
  formats: {
    backgroundColor: '#FFF9E6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  formatTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8B4513',
    marginBottom: 12,
  },
  formatText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  wedgeContainer: {
    flex: 1,
    backgroundColor: '#000',
    padding: 16,
    justifyContent: 'center',
  },
  wedgeInfoText: {
    color: '#fff',
    marginBottom: 8,
  },
  wedgeTouch: {
    marginBottom: 12,
  },
  wedgeInput: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
    color: '#e5e7eb',
    borderRadius: 10,
    height: 48,
    paddingHorizontal: 12,
  },
});