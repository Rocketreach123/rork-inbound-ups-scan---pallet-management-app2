import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { CheckCircle, XCircle, AlertCircle, RefreshCw, Database, Globe, Wifi, Clock } from 'lucide-react-native';
import { env } from '@/lib/env';
import * as acaClient from '@/api/acaClient';
import { useLocations } from '@/stores/locationsSlice';
import { usePlates } from '@/stores/platesSlice';

interface TestResult {
  name: string;
  status: 'pending' | 'success' | 'error' | 'warning';
  message: string;
  details?: any;
  timestamp?: number;
}

export default function ApiTestScreen() {
  const [tests, setTests] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const { locations: storeLocations, error: locError } = useLocations();
  const { plates: storePlates, error: platesError } = usePlates();

  const runTests = async () => {
    setIsRunning(true);
    const results: TestResult[] = [];
    console.log('[API TEST] Starting comprehensive API tests...');
    console.log('[API TEST] Environment:', { base: env.ACA_API_BASE, key: env.ACA_API_KEY ? 'SET' : 'NOT SET' });

    // Test 1: Environment Variables
    results.push({
      name: '🔧 Environment Configuration',
      status: env.ACA_API_BASE && env.ACA_API_KEY ? 'success' : 'error',
      message: env.ACA_API_BASE && env.ACA_API_KEY 
        ? `API Base: ${env.ACA_API_BASE}` 
        : 'Missing environment variables',
      details: {
        base: env.ACA_API_BASE || 'NOT SET',
        key: env.ACA_API_KEY ? '***' + env.ACA_API_KEY.slice(-4) : 'NOT SET'
      },
      timestamp: Date.now()
    });

    // Test 2: Direct API Connection
    try {
      console.log('[API TEST] Testing direct API connection...');
      const testUrl = `${env.ACA_API_BASE}/locations?service_key=${encodeURIComponent(env.ACA_API_KEY || '')}&limit=1`;
      const startTime = Date.now();
      const response = await fetch(testUrl, { signal: AbortSignal.timeout(10000) });
      const responseTime = Date.now() - startTime;
      
      console.log('[API TEST] Direct API response:', response.status, response.statusText);
      
      results.push({
        name: '🌐 Direct API Connection',
        status: response.ok ? 'success' : 'error',
        message: `API responded with ${response.status} in ${responseTime}ms`,
        details: {
          status: response.status,
          statusText: response.statusText,
          responseTime: `${responseTime}ms`,
          headers: {
            'content-type': response.headers.get('content-type'),
            'etag': response.headers.get('etag')
          }
        },
        timestamp: Date.now()
      });
    } catch (error: any) {
      console.error('[API TEST] Direct connection failed:', error);
      results.push({
        name: '🌐 Direct API Connection',
        status: 'error',
        message: `Connection failed: ${error.message}`,
        details: { error: error.message },
        timestamp: Date.now()
      });
    }

    // Test 3: Locations API
    try {
      console.log('[API TEST] Fetching locations...');
      const startTime = Date.now();
      const locations = await acaClient.getLocations({ manualRefresh: true });
      const elapsed = Date.now() - startTime;
      
      console.log('[API TEST] Locations fetched:', locations.length, 'items');
      console.log('[API TEST] Sample location:', locations[0]);
      
      const hasDummyData = locations.some((loc: any) => {
        const str = JSON.stringify(loc);
        return /LOC-\d+/.test(str) || /^LOC-/.test(loc.name || '') || /^LOC-/.test(loc.id || '');
      });

      results.push({
        name: '📍 Locations API',
        status: hasDummyData ? 'warning' : (locations.length > 0 ? 'success' : 'error'),
        message: hasDummyData 
          ? `⚠️ Possible dummy data! Found ${locations.length} locations`
          : `Fetched ${locations.length} real locations in ${elapsed}ms`,
        details: {
          count: locations.length,
          responseTime: `${elapsed}ms`,
          sample: locations.slice(0, 2).map((l: any) => ({
            id: l.id,
            name: l.name || l.label,
            zone: l.zone,
            aisle: l.aisle
          })),
          hasDummyData
        },
        timestamp: Date.now()
      });
    } catch (error: any) {
      console.error('[API TEST] Locations fetch failed:', error);
      results.push({
        name: '📍 Locations API',
        status: 'error',
        message: `Failed: ${error.message}`,
        details: { error: error.message },
        timestamp: Date.now()
      });
    }

    // Test 4: License Plates API
    try {
      console.log('[API TEST] Fetching license plates...');
      const startTime = Date.now();
      const plates = await acaClient.getLicensePlates({ manualRefresh: true });
      const elapsed = Date.now() - startTime;
      
      console.log('[API TEST] Plates fetched:', plates.length, 'items');
      console.log('[API TEST] Sample plate:', plates[0]);
      
      const hasDummyData = plates.some((plate: any) => {
        const str = JSON.stringify(plate);
        return /LP\s?\d{3,}/.test(str) || /TEST-/.test(str) || /DEMO-/.test(str);
      });

      results.push({
        name: '🚗 License Plates API',
        status: hasDummyData ? 'warning' : (plates.length > 0 ? 'success' : 'error'),
        message: hasDummyData 
          ? `⚠️ Possible dummy data! Found ${plates.length} plates`
          : `Fetched ${plates.length} real plates in ${elapsed}ms`,
        details: {
          count: plates.length,
          responseTime: `${elapsed}ms`,
          sample: plates.slice(0, 2).map((p: any) => ({
            id: p.id,
            plate_number: p.plate_number || p.plate || p.tag,
            state: p.state || p.region,
            location: p.location_id || p.location?.id
          })),
          hasDummyData
        },
        timestamp: Date.now()
      });
    } catch (error: any) {
      console.error('[API TEST] Plates fetch failed:', error);
      results.push({
        name: '🚗 License Plates API',
        status: 'error',
        message: `Failed: ${error.message}`,
        details: { error: error.message },
        timestamp: Date.now()
      });
    }

    // Test 5: Progressive Fetch Test
    try {
      console.log('[API TEST] Testing progressive fetch...');
      let batchCount = 0;
      let itemsPerBatch: number[] = [];
      
      const { total } = await acaClient.fetchAllProgressive('/locations', {
        limitQuery: 'limit=50',
        onBatch: (batch) => {
          batchCount++;
          itemsPerBatch.push(batch.length);
          console.log(`[API TEST] Batch ${batchCount}: ${batch.length} items`);
        }
      });
      
      results.push({
        name: '📦 Progressive Loading',
        status: 'success',
        message: `Loaded ${total} items in ${batchCount} batch(es)`,
        details: {
          totalItems: total,
          batchCount,
          itemsPerBatch,
          avgPerBatch: batchCount > 0 ? Math.round(total / batchCount) : 0
        },
        timestamp: Date.now()
      });
    } catch (error: any) {
      console.error('[API TEST] Progressive fetch failed:', error);
      results.push({
        name: '📦 Progressive Loading',
        status: 'error',
        message: `Failed: ${error.message}`,
        details: { error: error.message },
        timestamp: Date.now()
      });
    }

    // Test 6: Store Data Verification
    const storeHasDummy = storeLocations.some(loc => 
      /^LOC-/.test(loc.name) || /^LOC-/.test(loc.code || '')
    ) || storePlates.some(plate => 
      /^LP\s?\d/.test(plate.plate_number) && plate.plate_number.length < 10
    );

    console.log('[API TEST] Store verification:', {
      locations: storeLocations.length,
      plates: storePlates.length,
      hasDummy: storeHasDummy
    });

    results.push({
      name: '💾 Store Data Verification',
      status: storeHasDummy ? 'warning' : 'success',
      message: storeHasDummy 
        ? '⚠️ Possible dummy data in store!' 
        : `Store has ${storeLocations.length} locations, ${storePlates.length} plates`,
      details: {
        locations: storeLocations.length,
        plates: storePlates.length,
        locError,
        platesError,
        hasDummy: storeHasDummy
      },
      timestamp: Date.now()
    });

    // Test 7: API Response Format
    try {
      console.log('[API TEST] Checking API response format...');
      const testUrl = `${env.ACA_API_BASE}/locations?service_key=${encodeURIComponent(env.ACA_API_KEY || '')}&limit=1`;
      const response = await fetch(testUrl);
      const data = await response.json();
      
      const isValidFormat = Array.isArray(data) || Array.isArray(data?.data);
      
      console.log('[API TEST] Response format:', {
        isArray: Array.isArray(data),
        hasDataField: !!data?.data,
        keys: Object.keys(data || {})
      });
      
      results.push({
        name: '📋 API Response Format',
        status: isValidFormat ? 'success' : 'warning',
        message: isValidFormat 
          ? 'Valid API response format' 
          : 'Unexpected response format',
        details: {
          isArray: Array.isArray(data),
          hasDataField: !!data?.data,
          keys: Object.keys(data || {}).slice(0, 5)
        },
        timestamp: Date.now()
      });
    } catch (error: any) {
      console.error('[API TEST] Format check failed:', error);
      results.push({
        name: '📋 API Response Format',
        status: 'error',
        message: `Failed: ${error.message}`,
        details: { error: error.message },
        timestamp: Date.now()
      });
    }

    // Test Summary
    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;
    const warningCount = results.filter(r => r.status === 'warning').length;
    
    console.log('[API TEST] Test Summary:', {
      total: results.length,
      success: successCount,
      errors: errorCount,
      warnings: warningCount
    });

    setTests(results);
    setIsRunning(false);

    // Show alert if there are critical errors
    if (errorCount > 0) {
      Alert.alert(
        '❌ API Test Failed',
        `${errorCount} test(s) failed. Check the details for more information.`,
        [{ text: 'OK' }]
      );
    } else if (warningCount > 0) {
      Alert.alert(
        '⚠️ API Test Warning',
        `Tests passed with ${warningCount} warning(s). Review the results.`,
        [{ text: 'OK' }]
      );
    }
  };

  useEffect(() => {
    runTests();
  }, []);

  const getIcon = (status: TestResult['status']) => {
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

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return '#10b981';
      case 'error':
        return '#ef4444';
      case 'warning':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  };

  const successCount = tests.filter(t => t.status === 'success').length;
  const errorCount = tests.filter(t => t.status === 'error').length;
  const warningCount = tests.filter(t => t.status === 'warning').length;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Database color="#1e40af" size={24} />
        <Text style={styles.title}>API Test Report</Text>
        <TouchableOpacity 
          onPress={runTests} 
          disabled={isRunning}
          style={styles.refreshButton}
        >
          <RefreshCw color={isRunning ? '#9ca3af' : '#1e40af'} size={20} />
        </TouchableOpacity>
      </View>

      <View style={styles.summary}>
        <Globe color="#6b7280" size={16} />
        <Text style={styles.summaryText}>
          {env.ACA_API_BASE || 'No API configured'}
        </Text>
      </View>

      {tests.length > 0 && (
        <View style={styles.statsBar}>
          <View style={styles.stat}>
            <Text style={[styles.statCount, { color: '#10b981' }]}>{successCount}</Text>
            <Text style={styles.statLabel}>Passed</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statCount, { color: '#f59e0b' }]}>{warningCount}</Text>
            <Text style={styles.statLabel}>Warnings</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statCount, { color: '#ef4444' }]}>{errorCount}</Text>
            <Text style={styles.statLabel}>Failed</Text>
          </View>
        </View>
      )}

      {tests.map((test, index) => (
        <View key={index} style={styles.testCard}>
          <View style={styles.testHeader}>
            {getIcon(test.status)}
            <Text style={styles.testName}>{test.name}</Text>
          </View>
          <Text style={[styles.testMessage, { color: getStatusColor(test.status) }]}>
            {test.message}
          </Text>
          {test.details && (
            <View style={styles.details}>
              <Text style={styles.detailsText}>
                {JSON.stringify(test.details, null, 2)}
              </Text>
            </View>
          )}
          {test.timestamp && (
            <Text style={styles.timestamp}>
              {new Date(test.timestamp).toLocaleTimeString()}
            </Text>
          )}
        </View>
      ))}

      {tests.length === 0 && !isRunning && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Press refresh to run tests</Text>
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
    fontWeight: '600',
    color: '#111827',
    marginLeft: 12,
    flex: 1,
  },
  refreshButton: {
    padding: 8,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9fafb',
  },
  summaryText: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 8,
  },
  testCard: {
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
  testHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  testName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
  },
  testMessage: {
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
    fontFamily: 'monospace',
  },
  empty: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  stat: {
    alignItems: 'center',
  },
  statCount: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  timestamp: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 8,
  },
});