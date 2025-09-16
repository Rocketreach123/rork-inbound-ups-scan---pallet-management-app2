import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { CheckCircle, XCircle, AlertCircle, RefreshCw, Database, Globe } from 'lucide-react-native';
import { env } from '@/lib/env';
import { getLocations, getLicensePlates } from '@/api/acaClient';
import { useLocations } from '@/stores/locationsSlice';
import { usePlates } from '@/stores/platesSlice';

interface TestResult {
  name: string;
  status: 'pending' | 'success' | 'error' | 'warning';
  message: string;
  details?: any;
}

export default function ApiTestScreen() {
  const [tests, setTests] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const { locations: storeLocations, error: locError } = useLocations();
  const { plates: storePlates, error: platesError } = usePlates();

  const runTests = async () => {
    setIsRunning(true);
    const results: TestResult[] = [];

    // Test 1: Environment Variables
    results.push({
      name: 'Environment Configuration',
      status: env.ACA_API_BASE && env.ACA_API_KEY ? 'success' : 'error',
      message: env.ACA_API_BASE && env.ACA_API_KEY 
        ? `API Base: ${env.ACA_API_BASE}` 
        : 'Missing environment variables',
      details: {
        base: env.ACA_API_BASE || 'NOT SET',
        key: env.ACA_API_KEY ? '***' + env.ACA_API_KEY.slice(-4) : 'NOT SET'
      }
    });

    // Test 2: Locations API
    try {
      const startTime = Date.now();
      const locations = await getLocations({ manualRefresh: true });
      const elapsed = Date.now() - startTime;
      
      const hasDummyData = locations.some((loc: any) => {
        const str = JSON.stringify(loc);
        return /LOC-\d+/.test(str) || /^LOC-/.test(loc.name || '') || /^LOC-/.test(loc.id || '');
      });

      results.push({
        name: 'Locations API',
        status: hasDummyData ? 'error' : 'success',
        message: hasDummyData 
          ? `DUMMY DATA DETECTED! Found ${locations.length} locations`
          : `Fetched ${locations.length} real locations in ${elapsed}ms`,
        details: {
          count: locations.length,
          sample: locations.slice(0, 3).map((l: any) => ({
            id: l.id,
            name: l.name || l.label,
            zone: l.zone
          })),
          hasDummyData
        }
      });
    } catch (error: any) {
      results.push({
        name: 'Locations API',
        status: 'error',
        message: `Failed: ${error.message}`,
        details: { error: error.message }
      });
    }

    // Test 3: License Plates API
    try {
      const startTime = Date.now();
      const plates = await getLicensePlates({ manualRefresh: true });
      const elapsed = Date.now() - startTime;
      
      const hasDummyData = plates.some((plate: any) => {
        const str = JSON.stringify(plate);
        return /LP\s?\d{3,}/.test(str) && !str.includes('plate_number');
      });

      results.push({
        name: 'License Plates API',
        status: hasDummyData ? 'error' : 'success',
        message: hasDummyData 
          ? `DUMMY DATA DETECTED! Found ${plates.length} plates`
          : `Fetched ${plates.length} real plates in ${elapsed}ms`,
        details: {
          count: plates.length,
          sample: plates.slice(0, 3).map((p: any) => ({
            id: p.id,
            plate_number: p.plate_number || p.plate || p.tag,
            state: p.state || p.region
          })),
          hasDummyData
        }
      });
    } catch (error: any) {
      results.push({
        name: 'License Plates API',
        status: 'error',
        message: `Failed: ${error.message}`,
        details: { error: error.message }
      });
    }

    // Test 4: Store Data Verification
    const storeHasDummy = storeLocations.some(loc => 
      /^LOC-/.test(loc.name) || /^LOC-/.test(loc.code || '')
    ) || storePlates.some(plate => 
      /^LP\s?\d/.test(plate.plate_number) && plate.plate_number.length < 10
    );

    results.push({
      name: 'Store Data Verification',
      status: storeHasDummy ? 'error' : 'success',
      message: storeHasDummy 
        ? 'DUMMY DATA IN STORE!' 
        : `Store has ${storeLocations.length} locations, ${storePlates.length} plates`,
      details: {
        locations: storeLocations.length,
        plates: storePlates.length,
        locError,
        platesError,
        hasDummy: storeHasDummy
      }
    });

    // Test 5: API Response Format
    try {
      const testUrl = `${env.ACA_API_BASE}/locations?service_key=${encodeURIComponent(env.ACA_API_KEY)}&limit=1`;
      const response = await fetch(testUrl);
      const data = await response.json();
      
      const isValidFormat = Array.isArray(data) || Array.isArray(data?.data);
      
      results.push({
        name: 'API Response Format',
        status: isValidFormat ? 'success' : 'warning',
        message: isValidFormat 
          ? 'Valid API response format' 
          : 'Unexpected response format',
        details: {
          isArray: Array.isArray(data),
          hasDataField: !!data?.data,
          keys: Object.keys(data || {}).slice(0, 5)
        }
      });
    } catch (error: any) {
      results.push({
        name: 'API Response Format',
        status: 'error',
        message: `Failed: ${error.message}`,
        details: { error: error.message }
      });
    }

    setTests(results);
    setIsRunning(false);

    // Show alert if dummy data detected
    const hasDummy = results.some(r => r.message.includes('DUMMY'));
    if (hasDummy) {
      Alert.alert(
        '⚠️ Dummy Data Detected',
        'The app is still using mock/dummy data. Please check the API configuration and data sources.',
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

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Database color="#1e40af" size={24} />
        <Text style={styles.title}>API Connection Test</Text>
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
});