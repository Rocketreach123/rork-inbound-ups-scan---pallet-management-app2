import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  ScrollView, 
  TextInput,
  Alert,
  Platform 
} from 'react-native';
import { 
  AlertTriangle, 
  CheckCircle, 
  X, 
  Edit3, 
  Save,
  RotateCcw,
  Search,
  Package
} from 'lucide-react-native';
import { useWarehouse } from '@/providers/warehouse-provider';
import { ScanError } from '@/types/warehouse';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ErrorCorrectionScreen() {
  const [errors, setErrors] = useState<ScanError[]>([]);
  const [selectedError, setSelectedError] = useState<ScanError | null>(null);
  const [correctionData, setCorrectionData] = useState({
    tracking: '',
    poNumber: '',
    notes: ''
  });
  const [filter, setFilter] = useState<'all' | 'unresolved' | 'resolved'>('unresolved');
  const [searchQuery, setSearchQuery] = useState('');

  const { processPackageScan, assignToPallet } = useWarehouse();

  useEffect(() => {
    loadErrors();
  }, []);

  const loadErrors = async () => {
    try {
      const stored = await AsyncStorage.getItem('scan_errors');
      if (stored) {
        setErrors(JSON.parse(stored));
      } else {
        // Mock some errors for demo
        const mockErrors: ScanError[] = [
          {
            id: 'error-1',
            packageId: 'pkg-1',
            errorType: 'missing_po',
            message: 'PO number not found on label',
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            resolved: false
          },
          {
            id: 'error-2',
            packageId: 'pkg-2',
            errorType: 'invalid_tracking',
            message: 'Tracking number format invalid: 1Z123ABC',
            timestamp: new Date(Date.now() - 7200000).toISOString(),
            resolved: false
          },
          {
            id: 'error-3',
            packageId: 'pkg-3',
            errorType: 'ocr_failed',
            message: 'OCR confidence too low: 0.45',
            timestamp: new Date(Date.now() - 10800000).toISOString(),
            resolved: true,
            resolution: 'Manual entry: PO123456'
          }
        ];
        setErrors(mockErrors);
        await AsyncStorage.setItem('scan_errors', JSON.stringify(mockErrors));
      }
    } catch (error) {
      console.error('Error loading scan errors:', error);
    }
  };

  const saveErrors = async (updatedErrors: ScanError[]) => {
    try {
      await AsyncStorage.setItem('scan_errors', JSON.stringify(updatedErrors));
      setErrors(updatedErrors);
    } catch (error) {
      console.error('Error saving scan errors:', error);
    }
  };

  const selectError = (error: ScanError) => {
    setSelectedError(error);
    setCorrectionData({
      tracking: '',
      poNumber: '',
      notes: ''
    });
  };

  const resolveError = async () => {
    if (!selectedError) return;

    try {
      let resolution = 'Manual correction';
      
      if (correctionData.tracking || correctionData.poNumber) {
        if (correctionData.tracking && correctionData.poNumber) {
          const mockBarcode = correctionData.tracking;
          const result = await processPackageScan(mockBarcode);
          
          if (result.suggestedPallet) {
            await assignToPallet(result.package.id, result.suggestedPallet.id);
            resolution = `Corrected and assigned to ${result.suggestedPallet.palletCode}`;
          } else {
            resolution = 'Corrected data processed';
          }
        } else {
          resolution = `Partial correction: ${correctionData.tracking ? 'Tracking' : 'PO'} updated`;
        }
      }

      if (correctionData.notes) {
        resolution += ` - Notes: ${correctionData.notes}`;
      }

      const updatedErrors = errors.map(e => 
        e.id === selectedError.id 
          ? { ...e, resolved: true, resolution }
          : e
      );

      await saveErrors(updatedErrors);
      setSelectedError(null);
      setCorrectionData({ tracking: '', poNumber: '', notes: '' });

      Alert.alert('Success', 'Error resolved successfully');
    } catch (error) {
      console.error('Error resolving scan error:', error);
      Alert.alert('Error', 'Failed to resolve error');
    }
  };

  const skipError = async () => {
    if (!selectedError) return;

    const updatedErrors = errors.map(e => 
      e.id === selectedError.id 
        ? { ...e, resolved: true, resolution: 'Skipped - no action taken' }
        : e
    );

    await saveErrors(updatedErrors);
    setSelectedError(null);
    setCorrectionData({ tracking: '', poNumber: '', notes: '' });
  };

  const deleteError = async (errorId: string) => {
    Alert.alert(
      'Delete Error',
      'Are you sure you want to delete this error record?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            const updatedErrors = errors.filter(e => e.id !== errorId);
            await saveErrors(updatedErrors);
          }
        }
      ]
    );
  };

  const getFilteredErrors = () => {
    let filtered = errors;

    if (filter === 'unresolved') {
      filtered = filtered.filter(e => !e.resolved);
    } else if (filter === 'resolved') {
      filtered = filtered.filter(e => e.resolved);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(e => 
        e.message.toLowerCase().includes(query) ||
        e.errorType.toLowerCase().includes(query) ||
        e.packageId.toLowerCase().includes(query)
      );
    }

    return filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  const getErrorTypeColor = (errorType: string) => {
    switch (errorType) {
      case 'missing_po': return '#f59e0b';
      case 'invalid_tracking': return '#ef4444';
      case 'duplicate_scan': return '#8b5cf6';
      case 'ocr_failed': return '#06b6d4';
      case 'barcode_unreadable': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getErrorTypeIcon = (errorType: string) => {
    switch (errorType) {
      case 'missing_po': return Edit3;
      case 'invalid_tracking': return Package;
      case 'duplicate_scan': return RotateCcw;
      case 'ocr_failed': return Search;
      case 'barcode_unreadable': return AlertTriangle;
      default: return AlertTriangle;
    }
  };

  const filteredErrors = getFilteredErrors();
  const unresolvedCount = errors.filter(e => !e.resolved).length;

  return (
    <View style={styles.container}>
      {/* Header Stats */}
      <View style={styles.header}>
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{errors.length}</Text>
            <Text style={styles.statLabel}>Total Errors</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#ef4444' }]}>{unresolvedCount}</Text>
            <Text style={styles.statLabel}>Unresolved</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#10b981' }]}>{errors.length - unresolvedCount}</Text>
            <Text style={styles.statLabel}>Resolved</Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Search color="#6b7280" size={20} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search errors..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterTabs}>
          {(['all', 'unresolved', 'resolved'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.filterTab, filter === tab && styles.filterTabActive]}
              onPress={() => setFilter(tab)}
            >
              <Text style={[styles.filterTabText, filter === tab && styles.filterTabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Error List */}
      <ScrollView style={styles.errorsList} showsVerticalScrollIndicator={false}>
        {filteredErrors.length === 0 ? (
          <View style={styles.emptyState}>
            <CheckCircle color="#10b981" size={48} />
            <Text style={styles.emptyText}>
              {filter === 'unresolved' ? 'No unresolved errors' : 'No errors found'}
            </Text>
            <Text style={styles.emptySubtext}>
              {filter === 'unresolved' 
                ? 'Great job! All errors have been resolved.' 
                : 'Try adjusting your search or filter.'}
            </Text>
          </View>
        ) : (
          filteredErrors.map((error) => {
            const ErrorIcon = getErrorTypeIcon(error.errorType);
            const errorColor = getErrorTypeColor(error.errorType);
            
            return (
              <TouchableOpacity
                key={error.id}
                style={[styles.errorCard, error.resolved && styles.errorCardResolved]}
                onPress={() => !error.resolved && selectError(error)}
              >
                <View style={styles.errorHeader}>
                  <View style={styles.errorIconContainer}>
                    <ErrorIcon color={errorColor} size={20} />
                  </View>
                  <View style={styles.errorInfo}>
                    <Text style={styles.errorType}>
                      {error.errorType.replace('_', ' ').toUpperCase()}
                    </Text>
                    <Text style={styles.errorTime}>
                      {new Date(error.timestamp).toLocaleString()}
                    </Text>
                  </View>
                  <View style={styles.errorStatus}>
                    {error.resolved ? (
                      <CheckCircle color="#10b981" size={20} />
                    ) : (
                      <AlertTriangle color="#f59e0b" size={20} />
                    )}
                  </View>
                </View>

                <Text style={styles.errorMessage}>{error.message}</Text>
                
                {error.resolved && error.resolution && (
                  <View style={styles.resolutionContainer}>
                    <Text style={styles.resolutionLabel}>Resolution:</Text>
                    <Text style={styles.resolutionText}>{error.resolution}</Text>
                  </View>
                )}

                {!error.resolved && (
                  <View style={styles.errorActions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => selectError(error)}
                    >
                      <Edit3 color="#3b82f6" size={16} />
                      <Text style={styles.actionButtonText}>Fix</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => deleteError(error.id)}
                    >
                      <X color="#ef4444" size={16} />
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Correction Panel */}
      {selectedError && (
        <View style={styles.correctionPanel}>
          <View style={styles.correctionHeader}>
            <Text style={styles.correctionTitle}>Correct Error</Text>
            <TouchableOpacity onPress={() => setSelectedError(null)}>
              <X color="#6b7280" size={24} />
            </TouchableOpacity>
          </View>

          <Text style={styles.correctionDescription}>
            {selectedError.errorType}: {selectedError.message}
          </Text>

          <View style={styles.correctionForm}>
            <Text style={styles.fieldLabel}>Tracking Number</Text>
            <TextInput
              style={styles.correctionInput}
              placeholder="1Z..."
              value={correctionData.tracking}
              onChangeText={(text) => setCorrectionData({...correctionData, tracking: text})}
              autoCapitalize="characters"
            />

            <Text style={styles.fieldLabel}>PO Number</Text>
            <TextInput
              style={styles.correctionInput}
              placeholder="PO123456"
              value={correctionData.poNumber}
              onChangeText={(text) => setCorrectionData({...correctionData, poNumber: text})}
              autoCapitalize="characters"
            />

            <Text style={styles.fieldLabel}>Notes (Optional)</Text>
            <TextInput
              style={[styles.correctionInput, styles.notesInput]}
              placeholder="Additional notes..."
              value={correctionData.notes}
              onChangeText={(text) => setCorrectionData({...correctionData, notes: text})}
              multiline
              numberOfLines={2}
            />
          </View>

          <View style={styles.correctionActions}>
            <TouchableOpacity style={styles.resolveButton} onPress={resolveError}>
              <Save color="#fff" size={20} />
              <Text style={styles.resolveButtonText}>Resolve</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.skipButton} onPress={skipError}>
              <RotateCcw color="#6b7280" size={20} />
              <Text style={styles.skipButtonText}>Skip</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#111827',
  },
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 4,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  filterTabActive: {
    backgroundColor: '#fff',
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  filterTabTextActive: {
    color: '#111827',
  },
  errorsList: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#6b7280',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
  },
  errorCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
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
  errorCardResolved: {
    borderLeftColor: '#10b981',
    opacity: 0.8,
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  errorIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  errorInfo: {
    flex: 1,
  },
  errorType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  errorTime: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  errorStatus: {
    marginLeft: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 8,
  },
  resolutionContainer: {
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  resolutionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
    marginBottom: 4,
  },
  resolutionText: {
    fontSize: 14,
    color: '#065f46',
    lineHeight: 18,
  },
  errorActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3b82f6',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#fef2f2',
  },
  correctionPanel: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    padding: 16,
    maxHeight: '50%',
  },
  correctionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  correctionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  correctionDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  correctionForm: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 8,
    marginTop: 12,
  },
  correctionInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  notesInput: {
    height: 60,
    textAlignVertical: 'top',
  },
  correctionActions: {
    flexDirection: 'row',
    gap: 12,
  },
  resolveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  resolveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  skipButtonText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '500',
  },
});