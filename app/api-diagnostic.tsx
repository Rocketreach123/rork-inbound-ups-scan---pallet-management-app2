import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, Alert } from 'react-native';
import { CheckCircle, XCircle, AlertCircle, RefreshCw, Server, Globe, Database, Wifi, Shield } from 'lucide-react-native';
import { env } from '@/lib/env';
import { getLocations, getLicensePlates } from '@/api/acaClient';
import { useLocations } from '@/stores/locationsSlice';
import { usePlates } from '@/stores/platesSlice';

interface DiagnosticResult {
  name: string;
  status: 'pending' | 'success' | 'error' | 'warning';
  message: string;
  details?: any;
  solution?: string;
}

export default function ApiDiagnosticScreen() {
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [apiData, setApiData] = useState<any>({});
  const { locations: storeLocations, refresh: refreshLocations, error: locError } = useLocations();
  const { plates: storePlates, refresh: refreshPlates, error: platesError } = usePlates();

  const runDiagnostics = async () => {
    setIsRunning(true);
    const diagnostics: DiagnosticResult[] = [];
    const data: any = {};

    console.log('[DIAGNOSTIC] Starting API diagnostics...');

    // 1. Check environment setup
    const backendUrl = process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
    data.backendUrl = backendUrl;
    
    if (!backendUrl) {
      diagnostics.push({
        name: '🔧 Environment Setup',
        status: 'error',
        message: 'Backend URL not configured',
        details: { EXPO_PUBLIC_RORK_API_BASE_URL: 'NOT SET' },
        solution: 'Set EXPO_PUBLIC_RORK_API_BASE_URL environment variable'
      });
    } else {
      diagnostics.push({
        name: '🔧 Environment Setup',
        status: 'success',
        message: `Backend URL: ${backendUrl}`,
        details: { 
          backend: backendUrl,
          proxy: env.ACA_API_BASE,
          platform: Platform.OS
        }
      });
    }

    // 2. Test backend connectivity
    if (backendUrl) {
      try {
        console.log('[DIAGNOSTIC] Testing backend connectivity...');
        const healthUrl = `${backendUrl}/api/health`;
        const healthResponse = await fetch(healthUrl, { 
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(5000) 
        });
        
        if (healthResponse.ok) {
          diagnostics.push({
            name: '🏥 Backend Health',
            status: 'success',
            message: 'Backend is healthy',
            details: { url: healthUrl, status: healthResponse.status }
          });
        } else {
          diagnostics.push({
            name: '🏥 Backend Health',
            status: 'error',
            message: `Backend returned ${healthResponse.status}`,
            details: { url: healthUrl, status: healthResponse.status },
            solution: 'Check if backend server is running'
          });
        }
      } catch (error: any) {
        console.error('[DIAGNOSTIC] Backend health check failed:', error);
        diagnostics.push({
          name: '🏥 Backend Health',
          status: 'error',
          message: 'Cannot connect to backend',
          details: { error: error.message },
          solution: 'Ensure backend is running and accessible'
        });
      }

      // 3. Test ACA proxy endpoint
      try {
        console.log('[DIAGNOSTIC] Testing ACA proxy...');
        const proxyTestUrl = `${backendUrl}/api/aca/test`;
        const proxyResponse = await fetch(proxyTestUrl, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(20000)
        });
        
        const proxyData = await proxyResponse.json();
        data.proxyTest = proxyData;
        
        if (proxyData.status === 'ok') {
          diagnostics.push({
            name: '🔄 ACA Proxy',
            status: 'success',
            message: 'Proxy is working correctly',
            details: proxyData.summary
          });
        } else {
          diagnostics.push({
            name: '🔄 ACA Proxy',
            status: 'error',
            message: 'Proxy test failed',
            details: proxyData,
            solution: 'Check backend proxy configuration and ACA API credentials'
          });
        }
      } catch (error: any) {
        console.error('[DIAGNOSTIC] Proxy test failed:', error);
        diagnostics.push({
          name: '🔄 ACA Proxy',
          status: 'error',
          message: 'Proxy endpoint not responding',
          details: { error: error.message },
          solution: 'Verify backend proxy is configured correctly'
        });
      }

      // 4. Test direct ACA API (through proxy)
      try {
        console.log('[DIAGNOSTIC] Testing locations endpoint...');
        const locUrl = `${backendUrl}/api/aca/locations?limit=1`;
        const locResponse = await fetch(locUrl, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(10000)
        });
        
        if (locResponse.ok) {
          const locData = await locResponse.json();
          const isArray = Array.isArray(locData) || Array.isArray(locData?.data);
          data.locationsResponse = locData;
          
          diagnostics.push({
            name: '📍 Locations Endpoint',
            status: isArray ? 'success' : 'warning',
            message: isArray ? 'Locations API working' : 'Unexpected response format',
            details: {
              isArray,
              count: Array.isArray(locData) ? locData.length : (locData?.data?.length || 0),
              sample: Array.isArray(locData) ? locData[0] : locData?.data?.[0]
            }
          });
        } else {
          const errorText = await locResponse.text();
          diagnostics.push({
            name: '📍 Locations Endpoint',
            status: 'error',
            message: `API returned ${locResponse.status}`,
            details: { status: locResponse.status, error: errorText.substring(0, 200) },
            solution: 'Check ACA API credentials and endpoint availability'
          });
        }
      } catch (error: any) {
        console.error('[DIAGNOSTIC] Locations test failed:', error);
        diagnostics.push({
          name: '📍 Locations Endpoint',
          status: 'error',
          message: 'Failed to fetch locations',
          details: { error: error.message },
          solution: 'Verify network connectivity and API configuration'
        });
      }

      // 5. Test license plates endpoint
      try {
        console.log('[DIAGNOSTIC] Testing license plates endpoint...');
        const platesUrl = `${backendUrl}/api/aca/license-plates?limit=1`;
        const platesResponse = await fetch(platesUrl, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(10000)
        });
        
        if (platesResponse.ok) {
          const platesData = await platesResponse.json();
          const isArray = Array.isArray(platesData) || Array.isArray(platesData?.data);
          data.platesResponse = platesData;
          
          diagnostics.push({
            name: '🚗 License Plates Endpoint',
            status: isArray ? 'success' : 'warning',
            message: isArray ? 'License Plates API working' : 'Unexpected response format',
            details: {
              isArray,
              count: Array.isArray(platesData) ? platesData.length : (platesData?.data?.length || 0),
              sample: Array.isArray(platesData) ? platesData[0] : platesData?.data?.[0]
            }
          });
        } else {
          const errorText = await platesResponse.text();
          diagnostics.push({
            name: '🚗 License Plates Endpoint',
            status: 'error',
            message: `API returned ${platesResponse.status}`,
            details: { status: platesResponse.status, error: errorText.substring(0, 200) },
            solution: 'Check ACA API credentials and endpoint availability'
          });
        }
      } catch (error: any) {
        console.error('[DIAGNOSTIC] License plates test failed:', error);
        diagnostics.push({
          name: '🚗 License Plates Endpoint',
          status: 'error',
          message: 'Failed to fetch license plates',
          details: { error: error.message },
          solution: 'Verify network connectivity and API configuration'
        });
      }
    }

    // 6. Test acaClient functions
    if (backendUrl) {
      try {
        console.log('[DIAGNOSTIC] Testing acaClient.getLocations...');
        const clientLocations = await getLocations({ manualRefresh: true });
        data.clientLocations = clientLocations;
        
        const hasDummyLoc = clientLocations.some((loc: any) => {
          const id = String(loc.id || '');
          const name = String(loc.name || loc.label || '');
          return id.includes('LOC-') || name.includes('LOC-');
        });
        
        diagnostics.push({
          name: '🔌 ACA Client (Locations)',
          status: clientLocations.length > 0 ? (hasDummyLoc ? 'error' : 'success') : 'warning',
          message: hasDummyLoc 
            ? `DUMMY DATA DETECTED! ${clientLocations.length} locations`
            : `${clientLocations.length} real locations loaded`,
          details: {
            count: clientLocations.length,
            hasDummy: hasDummyLoc,
            sample: clientLocations[0]
          },
          solution: hasDummyLoc ? 'API is returning mock data - check backend proxy' : undefined
        });
      } catch (error: any) {
        diagnostics.push({
          name: '🔌 ACA Client (Locations)',
          status: 'error',
          message: 'Client fetch failed',
          details: { error: error.message },
          solution: 'Check acaClient configuration'
        });
      }
      
      try {
        console.log('[DIAGNOSTIC] Testing acaClient.getLicensePlates...');
        const clientPlates = await getLicensePlates({ manualRefresh: true });
        data.clientPlates = clientPlates;
        
        const hasDummyPlate = clientPlates.some((plate: any) => {
          const plateNum = String(plate.plate_number || plate.plate || plate.tag || '');
          return plateNum.match(/^LP ?\d/);
        });
        
        diagnostics.push({
          name: '🔌 ACA Client (Plates)',
          status: clientPlates.length > 0 ? (hasDummyPlate ? 'error' : 'success') : 'warning',
          message: hasDummyPlate 
            ? `DUMMY DATA DETECTED! ${clientPlates.length} plates`
            : `${clientPlates.length} real plates loaded`,
          details: {
            count: clientPlates.length,
            hasDummy: hasDummyPlate,
            sample: clientPlates[0]
          },
          solution: hasDummyPlate ? 'API is returning mock data - check backend proxy' : undefined
        });
      } catch (error: any) {
        diagnostics.push({
          name: '🔌 ACA Client (Plates)',
          status: 'error',
          message: 'Client fetch failed',
          details: { error: error.message },
          solution: 'Check acaClient configuration'
        });
      }
    }
    
    // 7. Check store state
    diagnostics.push({
      name: '💾 Store (Locations)',
      status: storeLocations.length > 0 ? 'success' : 'warning',
      message: `${storeLocations.length} locations in store`,
      details: {
        count: storeLocations.length,
        error: locError,
        sample: storeLocations[0]
      }
    });
    
    diagnostics.push({
      name: '💾 Store (Plates)',
      status: storePlates.length > 0 ? 'success' : 'warning',
      message: `${storePlates.length} plates in store`,
      details: {
        count: storePlates.length,
        error: platesError,
        sample: storePlates[0]
      }
    });
    
    // 8. Check for dummy data patterns
    const checkForDummy = (data: any, type: string) => {
      if (!data) return false;
      const str = JSON.stringify(data);
      const patterns = [/LOC-\d+/, /LP ?\d{3,}/, /TEST-/, /DEMO-/, /MOCK-/];
      return patterns.some(p => p.test(str));
    };

    const anyDummyData = 
      checkForDummy(data.locationsResponse, 'locations') ||
      checkForDummy(data.platesResponse, 'plates') ||
      checkForDummy(data.clientLocations, 'clientLoc') ||
      checkForDummy(data.clientPlates, 'clientPlates');
      
    diagnostics.push({
      name: '✅ Data Validation',
      status: anyDummyData ? 'error' : 'success',
      message: anyDummyData ? 'DUMMY DATA DETECTED IN SYSTEM!' : 'All data appears to be real',
      details: { 
        hasAnyDummy: anyDummyData,
        sources: {
          directAPI: checkForDummy(data.locationsResponse, 'loc') || checkForDummy(data.platesResponse, 'pl'),
          acaClient: checkForDummy(data.clientLocations, 'cl') || checkForDummy(data.clientPlates, 'cp'),
          stores: checkForDummy(storeLocations, 'sl') || checkForDummy(storePlates, 'sp')
        }
      },
      solution: anyDummyData ? 'Check backend proxy is using real ACA API endpoints' : undefined
    })

    // 9. Network diagnostics
    diagnostics.push({
      name: '🌐 Network Info',
      status: 'success',
      message: 'Network configuration',
      details: {
        platform: Platform.OS,
        isWeb: Platform.OS === 'web',
        backendUrl: backendUrl || 'NOT SET',
        proxyUrl: env.ACA_API_BASE
      }
    });

    // Summary
    const successCount = diagnostics.filter(d => d.status === 'success').length;
    const errorCount = diagnostics.filter(d => d.status === 'error').length;
    const warningCount = diagnostics.filter(d => d.status === 'warning').length;

    diagnostics.push({
      name: '📊 Summary',
      status: errorCount > 0 ? 'error' : (warningCount > 0 ? 'warning' : 'success'),
      message: `${successCount} passed, ${warningCount} warnings, ${errorCount} failed`,
      details: {
        total: diagnostics.length - 1,
        success: successCount,
        warnings: warningCount,
        errors: errorCount
      }
    });

    setApiData(data);
    setResults(diagnostics);
    setIsRunning(false);

    console.log('[DIAGNOSTIC] Complete:', {
      success: successCount,
      warnings: warningCount,
      errors: errorCount,
      data
    });
    
    // Alert if dummy data detected
    const hasDummy = diagnostics.some(d => d.message.includes('DUMMY DATA'));
    if (hasDummy) {
      Alert.alert(
        '⚠️ Dummy Data Detected',
        'The system is showing mock/dummy data instead of real API data. Check the backend configuration.',
        [{ text: 'OK' }]
      );
    } else if (errorCount === 0 && warningCount === 0) {
      Alert.alert(
        '✅ All Tests Passed',
        'API is fully operational with live data.',
        [{ text: 'OK' }]
      );
    }
  };
  
  const refreshStores = async () => {
    console.log('[DIAGNOSTIC] Refreshing stores...');
    await Promise.all([
      refreshLocations(true),
      refreshPlates(true)
    ]);
    Alert.alert('✅ Stores Refreshed', 'Location and plate stores have been refreshed.');
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  const getIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle color="#10b981" size={20} />;
      case 'error':
        return <XCircle color="#ef4444" size={20} />;
      case 'warning':
        return <AlertCircle color="#f59e0b" size={20} />;
      default:
        return <ActivityIndicator size="small" />;
    }
  };

  const getStatusColor = (status: DiagnosticResult['status']) => {
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
        <Text style={styles.title}>API Diagnostic Report</Text>
        <TouchableOpacity 
          onPress={runDiagnostics} 
          disabled={isRunning}
          style={styles.refreshButton}
        >
          <RefreshCw color={isRunning ? '#9ca3af' : '#1e40af'} size={20} />
        </TouchableOpacity>
      </View>
      
      <View style={styles.actions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={refreshStores}
        >
          <Database color="#fff" size={16} />
          <Text style={styles.actionText}>Refresh Stores</Text>
        </TouchableOpacity>
      </View>

      {results.map((result, index) => (
        <View key={`${result.name}-${index}`} style={[
          styles.card,
          result.message.includes('DUMMY DATA') && styles.cardError
        ]}>
          <View style={styles.cardHeader}>
            {getIcon(result.status)}
            <Text style={styles.cardTitle}>{result.name}</Text>
          </View>
          
          <Text style={[styles.message, { color: getStatusColor(result.status) }]}>
            {result.message}
          </Text>
          
          {result.solution && (
            <View style={styles.solution}>
              <Text style={styles.solutionLabel}>Solution:</Text>
              <Text style={styles.solutionText}>{result.solution}</Text>
            </View>
          )}
          
          {result.details && (
            <View style={styles.details}>
              <Text style={styles.detailsText}>
                {JSON.stringify(result.details, null, 2)}
              </Text>
            </View>
          )}
        </View>
      ))}

      {results.length === 0 && !isRunning && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Press refresh to run diagnostics</Text>
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
  solution: {
    backgroundColor: '#fef3c7',
    borderRadius: 4,
    padding: 8,
    marginBottom: 8,
  },
  solutionLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#92400e',
    marginBottom: 2,
  },
  solutionText: {
    fontSize: 12,
    color: '#78350f',
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
  empty: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e40af',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  actionText: {
    color: '#fff',
    fontWeight: '600' as const,
    fontSize: 14,
  },
  cardError: {
    borderWidth: 2,
    borderColor: '#ef4444',
  },
});