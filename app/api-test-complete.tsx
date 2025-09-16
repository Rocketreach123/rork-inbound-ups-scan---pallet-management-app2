import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, Platform, ActivityIndicator } from 'react-native';
import { CheckCircle, XCircle, AlertCircle, RefreshCw, Wifi, Database, Shield, Scan } from 'lucide-react-native';
import { env } from '@/lib/env';
import { getLocations, getLicensePlates } from '@/api/acaClient';
import { useScan } from '@/providers/scan-provider';
import { useWarehouse } from '@/providers/warehouse-provider';

interface TestResult {
  name: string;
  status: 'pending' | 'success' | 'error' | 'warning';
  message: string;
  details?: any;
  timestamp?: string;
}

export default function ApiTestCompleteScreen() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [apiData, setApiData] = useState<any>({});
  const { deviceMode, activeAdapter, isBound, onScan } = useScan();
  const { processPackageScan, locations, pallets } = useWarehouse();

  // Setup barcode scanner listener
  useEffect(() => {
    if (deviceMode === 'skorpio-x5') {
      const unsubscribe = onScan((data) => {
        console.log('[TEST] Barcode scanned via hardware:', data);
        setScanInput(data);
        processTestScan(data);
      });
      return unsubscribe;
    }
  }, [deviceMode, onScan]);

  const processTestScan = async (barcode: string) => {
    const testResult: TestResult = {
      name: '📦 Package Scan Test',
      status: 'pending',
      message: `Processing: ${barcode}`,
      timestamp: new Date().toISOString()
    };
    
    setResults(prev => [...prev, testResult]);
    
    try {
      const result = await processPackageScan(barcode);
      
      const updatedResult: TestResult = {
        ...testResult,
        status: result.apiMatched ? 'success' : 'warning',
        message: result.apiMatched 
          ? `Package found: PO ${result.po?.poNumber}` 
          : 'Package not in API - moved to unmatched',
        details: {
          tracking: result.package?.tracking,
          po: result.po?.poNumber,
          pallet: result.suggestedPallet?.palletCode,
          apiMatched: result.apiMatched
        }
      };
      
      setResults(prev => prev.map(r => 
        r.timestamp === testResult.timestamp ? updatedResult : r
      ));
    } catch (error: any) {
      const updatedResult: TestResult = {
        ...testResult,
        status: 'error',
        message: 'Scan processing failed',
        details: { error: error.message }
      };
      
      setResults(prev => prev.map(r => 
        r.timestamp === testResult.timestamp ? updatedResult : r
      ));
    }
  };

  const runComprehensiveTest = async () => {
    setIsRunning(true);
    const tests: TestResult[] = [];
    const data: any = {};

    console.log('[TEST] Starting comprehensive API and scanner test...');

    // 1. Environment Check
    const backendUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
    tests.push({
      name: '🔧 Environment',
      status: backendUrl ? 'success' : 'error',
      message: backendUrl ? `Backend: ${backendUrl}` : 'Backend URL not configured',
      details: { 
        backend: backendUrl || 'NOT SET',
        proxy: env.ACA_API_BASE,
        platform: Platform.OS
      }
    });

    // 2. Scanner Configuration
    tests.push({
      name: '📱 Scanner Setup',
      status: deviceMode ? 'success' : 'warning',
      message: deviceMode 
        ? `Mode: ${deviceMode === 'skorpio-x5' ? 'Skorpio X5 Hardware' : deviceMode}`
        : 'No device mode selected',
      details: {
        deviceMode,
        adapter: activeAdapter,
        bound: isBound
      }
    });

    // 3. Backend Health Check
    if (backendUrl) {
      try {
        const healthResponse = await fetch(`${backendUrl}/api/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000)
        });
        
        tests.push({
          name: '🏥 Backend Health',
          status: healthResponse.ok ? 'success' : 'error',
          message: healthResponse.ok ? 'Backend is healthy' : `Backend returned ${healthResponse.status}`,
          details: { status: healthResponse.status }
        });
      } catch (error: any) {
        tests.push({
          name: '🏥 Backend Health',
          status: 'error',
          message: 'Cannot connect to backend',
          details: { error: error.message }
        });
      }

      // 4. ACA Proxy Test
      try {
        const proxyTest = await fetch(`${backendUrl}/api/aca/test`, {
          method: 'GET',
          signal: AbortSignal.timeout(15000)
        });
        
        const proxyData = await proxyTest.json();
        data.proxyTest = proxyData;
        
        tests.push({
          name: '🔄 ACA Proxy',
          status: proxyData.status === 'ok' ? 'success' : 'error',
          message: proxyData.status === 'ok' 
            ? `Locations: ${proxyData.summary?.locationsCount || 0}, Plates: ${proxyData.summary?.licensePlatesCount || 0}`
            : 'Proxy test failed',
          details: proxyData.summary
        });
      } catch (error: any) {
        tests.push({
          name: '🔄 ACA Proxy',
          status: 'error',
          message: 'Proxy not responding',
          details: { error: error.message }
        });
      }

      // 5. Direct API Test - Locations
      try {
        console.log('[TEST] Fetching locations...');
        const locationsData = await getLocations({ manualRefresh: true });
        data.locations = locationsData;
        
        const hasDummyLoc = locationsData.some((loc: any) => 
          String(loc.id || loc.name || '').includes('LOC-')
        );
        
        tests.push({
          name: '📍 Locations API',
          status: locationsData.length > 0 ? (hasDummyLoc ? 'warning' : 'success') : 'error',
          message: `${locationsData.length} locations loaded`,
          details: {
            count: locationsData.length,
            hasDummy: hasDummyLoc,
            sample: locationsData[0]
          }
        });
      } catch (error: any) {
        tests.push({
          name: '📍 Locations API',
          status: 'error',
          message: 'Failed to fetch locations',
          details: { error: error.message }
        });
      }

      // 6. Direct API Test - License Plates
      try {
        console.log('[TEST] Fetching license plates...');
        const platesData = await getLicensePlates({ manualRefresh: true });
        data.plates = platesData;
        
        const hasDummyPlate = platesData.some((plate: any) => 
          String(plate.plate_number || plate.id || '').match(/^LP ?\d/)
        );
        
        tests.push({
          name: '🚗 License Plates API',
          status: platesData.length > 0 ? (hasDummyPlate ? 'warning' : 'success') : 'error',
          message: `${platesData.length} plates loaded`,
          details: {
            count: platesData.length,
            hasDummy: hasDummyPlate,
            sample: platesData[0]
          }
        });
      } catch (error: any) {
        tests.push({
          name: '🚗 License Plates API',
          status: 'error',
          message: 'Failed to fetch plates',
          details: { error: error.message }
        });
      }
    }

    // 7. Local State Check
    tests.push({
      name: '💾 Local State',
      status: 'success',
      message: `${locations.length} locations, ${pallets.length} pallets in memory`,
      details: {
        locations: locations.length,
        pallets: pallets.length,
        activePallets: pallets.filter(p => p.state === 'OPEN').length
      }
    });

    // 8. Data Validation
    const validation = {
      realData: !data.locations?.some((l: any) => String(l.id).includes('LOC-')) &&
                !data.plates?.some((p: any) => String(p.plate_number).match(/^LP ?\d/)),
      apiWorking: data.proxyTest?.status === 'ok',
      scannerReady: deviceMode === 'skorpio-x5' && activeAdapter === 'wedge'
    };
    
    tests.push({
      name: '✅ System Status',
      status: validation.realData && validation.apiWorking && validation.scannerReady ? 'success' : 
              (validation.apiWorking ? 'warning' : 'error'),
      message: validation.realData && validation.apiWorking && validation.scannerReady 
        ? 'System fully operational' 
        : 'Some components need attention',
      details: validation
    });

    setApiData(data);
    setResults(tests);
    setIsRunning(false);

    // Summary alert
    const errors = tests.filter(t => t.status === 'error').length;
    const warnings = tests.filter(t => t.status === 'warning').length;
    
    if (errors === 0 && warnings === 0) {
      Alert.alert('✅ All Tests Passed', 'System is fully operational with live data.');
    } else if (errors > 0) {
      Alert.alert('❌ Tests Failed', `${errors} errors, ${warnings} warnings found. Check the report.`);
    } else {
      Alert.alert('⚠️ Tests Complete', `All critical systems working. ${warnings} warnings to review.`);
    }
  };

  useEffect(() => {
    runComprehensiveTest();
  }, []);

  const getIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success': return <CheckCircle color="#10b981" size={20} />;
      case 'error': return <XCircle color="#ef4444" size={20} />;
      case 'warning': return <AlertCircle color="#f59e0b" size={20} />;
      default: return <ActivityIndicator size="small" />;
    }
  };

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'success': return '#10b981';
      case 'error': return '#ef4444';
      case 'warning': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Shield color="#1e40af" size={24} />
        <Text style={styles.title}>Complete System Test</Text>
        <TouchableOpacity 
          onPress={runComprehensiveTest} 
          disabled={isRunning}
          style={styles.refreshButton}
        >
          <RefreshCw color={isRunning ? '#9ca3af' : '#1e40af'} size={20} />
        </TouchableOpacity>
      </View>

      {deviceMode === 'skorpio-x5' && (
        <View style={styles.scannerSection}>
          <View style={styles.scannerHeader}>
            <Scan color="#10b981" size={20} />
            <Text style={styles.scannerTitle}>Hardware Scanner Test</Text>
          </View>
          <TextInput
            style={styles.scanInput}
            value={scanInput}
            onChangeText={setScanInput}
            placeholder="Scan or type barcode here"
            placeholderTextColor="#9ca3af"
            autoFocus
            onSubmitEditing={() => {
              if (scanInput) {
                processTestScan(scanInput);
              }
            }}
          />
          <Text style={styles.scanHint}>Focus this field and use hardware scanner</Text>
        </View>
      )}

      {results.map((result, index) => (
        <View key={`${result.name}-${index}`} style={styles.card}>
          <View style={styles.cardHeader}>
            {getIcon(result.status)}
            <Text style={styles.cardTitle}>{result.name}</Text>
          </View>
          
          <Text style={[styles.message, { color: getStatusColor(result.status) }]}>
            {result.message}
          </Text>
          
          {result.details && (
            <View style={styles.details}>
              <Text style={styles.detailsText}>
                {JSON.stringify(result.details, null, 2)}
              </Text>
            </View>
          )}
        </View>
      ))}

      {apiData.locations && (
        <View style={styles.dataSection}>
          <Text style={styles.dataSectionTitle}>📊 Live Data Sample</Text>
          <View style={styles.dataCard}>
            <Text style={styles.dataLabel}>First Location:</Text>
            <Text style={styles.dataValue}>
              {JSON.stringify(apiData.locations[0], null, 2)}
            </Text>
          </View>
          {apiData.plates && (
            <View style={styles.dataCard}>
              <Text style={styles.dataLabel}>First Plate:</Text>
              <Text style={styles.dataValue}>
                {JSON.stringify(apiData.plates[0], null, 2)}
              </Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#111827',
    marginLeft: 12,
    flex: 1,
  },
  refreshButton: {
    padding: 8,
  },
  scannerSection: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  scannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  scannerTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#111827',
    marginLeft: 8,
  },
  scanInput: {
    borderWidth: 2,
    borderColor: '#10b981',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#f9fafb',
  },
  scanHint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#111827',
    marginLeft: 8,
  },
  message: {
    fontSize: 13,
    marginBottom: 8,
  },
  details: {
    backgroundColor: '#f9fafb',
    borderRadius: 4,
    padding: 8,
    marginTop: 8,
  },
  detailsText: {
    fontSize: 11,
    color: '#6b7280',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  dataSection: {
    margin: 16,
  },
  dataSectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#111827',
    marginBottom: 12,
  },
  dataCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  dataLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#6b7280',
    marginBottom: 4,
  },
  dataValue: {
    fontSize: 11,
    color: '#374151',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});