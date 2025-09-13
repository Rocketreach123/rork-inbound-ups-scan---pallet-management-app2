import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  ScrollView, 
  Alert,
  Modal,
  TextInput,
  Platform 
} from 'react-native';

import { 
  Package, 
  Play, 
  Pause, 
  Square, 
  AlertTriangle, 
  CheckCircle, 
  Edit3,
  X,
  RotateCcw,
  Printer,
  History,
  Plus,
  RefreshCw,
  ChevronDown
} from 'lucide-react-native';
import { useWarehouse } from '@/providers/warehouse-provider';
import { EnhancedBarcodeScanner } from '@/components/EnhancedBarcodeScanner';
import { parseLabel } from '@/lib/parsers/labelParser';
import { BatchScanSession, ScanError, LabelExtractionResult, Pallet, ScanEvent } from '@/types/warehouse';

export default function BatchScanScreen() {
  const [session, setSession] = useState<BatchScanSession | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [errors, setErrors] = useState<ScanError[]>([]);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [selectedError, setSelectedError] = useState<ScanError | null>(null);
  const [correctionValue, setCorrectionValue] = useState('');
  const [scanMode, setScanMode] = useState<'barcode' | 'label'>('barcode');
  const [lastScanResult, setLastScanResult] = useState<any>(null);
  
  const {
    processPackageScan,
    assignToPallet,
    activePallet,
    activePalletId,
    setActivePalletByCode,
    setActivePalletById,
    pallets,
    createNamedPallet,
    printLicensePlate,
    matchPalletCodeFromScan,
    scanEvents,
  } = useWarehouse();
  const sessionRef = useRef<BatchScanSession | null>(null);
  const [showPalletModal, setShowPalletModal] = useState(false);
  const [newPalletName, setNewPalletName] = useState('');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyFilterPalletId, setHistoryFilterPalletId] = useState<string | 'ALL'>('ALL');
  const [historyFilterDate, setHistoryFilterDate] = useState<string | 'TODAY' | 'ALL'>('TODAY');
  const [historyFilterErrorsOnly, setHistoryFilterErrorsOnly] = useState(false);

  const filteredEvents = useMemo<ScanEvent[]>(() => {
    return scanEvents.filter((e) => {
      const dateOk = historyFilterDate === 'ALL' || new Date(e.timestamp).toDateString() === new Date().toDateString();
      const palletOk = historyFilterPalletId === 'ALL' || e.palletId === historyFilterPalletId;
      const errOk = !historyFilterErrorsOnly || e.eventType.includes('ERROR') || e.eventType.includes('UNMATCHED');
      return dateOk && palletOk && errOk;
    });
  }, [scanEvents, historyFilterDate, historyFilterPalletId, historyFilterErrorsOnly]);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const startSession = () => {
    const newSession: BatchScanSession = {
      id: `batch-${Date.now()}`,
      startTime: new Date().toISOString(),
      packagesScanned: 0,
      errorsCount: 0,
      status: 'active',
      packages: []
    };
    setSession(newSession);
    setIsScanning(true);
    console.log('Started batch scan session:', newSession.id);
  };

  const pauseSession = () => {
    if (session) {
      setSession({ ...session, status: 'paused' });
      setIsScanning(false);
      console.log('Paused batch scan session');
    }
  };

  const resumeSession = () => {
    if (session) {
      setSession({ ...session, status: 'active' });
      setIsScanning(true);
      console.log('Resumed batch scan session');
    }
  };

  const endSession = () => {
    if (session) {
      const endedSession = {
        ...session,
        endTime: new Date().toISOString(),
        status: 'completed' as const
      };
      setSession(endedSession);
      setIsScanning(false);
      
      Alert.alert(
        'Session Complete',
        `Scanned ${endedSession.packagesScanned} packages with ${endedSession.errorsCount} errors`,
        [
          { text: 'View Summary', onPress: () => showSessionSummary(endedSession) },
          { text: 'New Session', onPress: () => setSession(null) }
        ]
      );
    }
  };

  const showSessionSummary = (completedSession: BatchScanSession) => {
    const duration = completedSession.endTime 
      ? Math.round((new Date(completedSession.endTime).getTime() - new Date(completedSession.startTime).getTime()) / 1000 / 60)
      : 0;
    
    Alert.alert(
      'Session Summary',
      `Duration: ${duration} minutes\nPackages: ${completedSession.packagesScanned}\nErrors: ${completedSession.errorsCount}\nSuccess Rate: ${Math.round((completedSession.packagesScanned - completedSession.errorsCount) / completedSession.packagesScanned * 100)}%`
    );
  };

  const handleBarcodeScan = async (data: string) => {
    if (!session || session.status !== 'active') return;

    console.log('Processing barcode in batch mode:', data);

    // Detect pallet LP scans first
    const matchedPalletCode = matchPalletCodeFromScan(data);
    if (matchedPalletCode) {
      console.log('Detected Pallet LP. Switching active pallet to code:', matchedPalletCode);
      const ok = await setActivePalletByCode(matchedPalletCode);
      if (!ok) {
        Alert.alert('Pallet Not Found', `No pallet matches code ${matchedPalletCode}`);
      }
      setLastScanResult({
        type: 'PALLET_SWITCH',
        palletCode: matchedPalletCode,
        timestamp: new Date().toISOString(),
      });
      return;
    }
    
    try {
      const result = await processPackageScan(data);
      
      // Auto-assign to active pallet if set
      if (activePalletId) {
        await assignToPallet(result.package.id, activePalletId);
      } else if (result.suggestedPallet) {
        await assignToPallet(result.package.id, result.suggestedPallet.id);
      }

      // Update session
      const updatedSession = {
        ...session,
        packagesScanned: session.packagesScanned + 1,
        packages: [...session.packages, result.package]
      };
      setSession(updatedSession);
      setLastScanResult(result);

      console.log(`Batch scan: ${updatedSession.packagesScanned} packages processed`);
      
    } catch (error) {
      console.error('Batch scan error:', error);
      addError({
        id: `error-${Date.now()}`,
        packageId: `unknown-${Date.now()}`,
        errorType: 'barcode_unreadable',
        message: 'Failed to process barcode',
        timestamp: new Date().toISOString(),
        resolved: false
      });
    }
  };

  const handleLabelExtracted = async (result: LabelExtractionResult) => {
    if (!session || session.status !== 'active') return;

    console.log('=== BATCH SCAN PROCESSING ===');
    console.log('Raw scanner result:', {
      barcodes: result.rawBarcodes?.length || 0,
      ocrLines: result.ocrLines?.length || 0
    });
    
    try {
      // Parse the label using our robust parser
      const parsed = parseLabel(result.rawBarcodes || [], result.ocrLines || []);
      
      console.log('Parsed result:', {
        tracking: parsed.tracking,
        poNumber: parsed.poNumber,
        carrier: parsed.carrier,
        confidence: parsed.confidence
      });
      
      // Validate that we have the minimum required data
      const hasValidTracking = !!parsed.tracking && (
        (parsed.carrier === 'UPS' && /^1Z[A-Z0-9]{16}$/.test(parsed.tracking)) ||
        (parsed.carrier === 'FEDEX' && /^\d{12,22}$/.test(parsed.tracking)) ||
        (parsed.carrier === 'UNKNOWN' && parsed.tracking.length >= 8) // Allow unknown carriers with min length
      );
      
      const hasValidPO = !!parsed.poNumber && parsed.poNumber.length >= 3;
      
      // Require both tracking AND PO for batch processing
      if (!hasValidTracking) {
        addError({
          id: `error-${Date.now()}`,
          packageId: `invalid-tracking-${Date.now()}`,
          errorType: 'invalid_tracking',
          message: `Invalid tracking number. Expected: UPS (1Z...) or FedEx (12-22 digits). Found: ${parsed.tracking || 'None'}`,
          timestamp: new Date().toISOString(),
          resolved: false
        });
        return;
      }
      
      if (!hasValidPO) {
        addError({
          id: `error-${Date.now()}`,
          packageId: `missing-po-${Date.now()}`,
          errorType: 'missing_po',
          message: `Missing PO number. Please ensure PO field is clearly visible. Found: ${parsed.poNumber || 'None'}`,
          timestamp: new Date().toISOString(),
          resolved: false
        });
        return;
      }
      
      // Process the valid package
      await handleBarcodeScan(parsed.tracking!);
      
    } catch (error) {
      console.error('Label processing error:', error);
      addError({
        id: `error-${Date.now()}`,
        packageId: `processing-error-${Date.now()}`,
        errorType: 'ocr_failed',
        message: 'Failed to process label data',
        timestamp: new Date().toISOString(),
        resolved: false
      });
    }
  };

  const addError = (error: ScanError) => {
    setErrors([...errors, error]);
    if (session) {
      setSession({
        ...session,
        errorsCount: session.errorsCount + 1
      });
    }
  };

  const resolveError = (errorId: string, resolution: string) => {
    setErrors(errors.map(e => 
      e.id === errorId 
        ? { ...e, resolved: true, resolution }
        : e
    ));
    setShowErrorModal(false);
    setSelectedError(null);
    setCorrectionValue('');
  };

  const openErrorCorrection = (error: ScanError) => {
    setSelectedError(error);
    setCorrectionValue('');
    setShowErrorModal(true);
  };

  if (!session) {
    return (
      <View style={styles.container}>
        <View style={styles.welcomeCard}>
          <Package color="#10b981" size={64} />
          <Text style={styles.welcomeTitle}>Batch Scanning Mode</Text>
          <Text style={styles.welcomeDescription}>
            Scan hundreds of packages quickly with automatic pallet assignment and error tracking
          </Text>
          
          <View style={styles.modeSelector}>
            <Text style={styles.modeSelectorTitle}>Scan Mode:</Text>
            <View style={styles.modeButtons}>
              <TouchableOpacity
                style={[styles.modeButton, scanMode === 'barcode' && styles.modeButtonActive]}
                onPress={() => setScanMode('barcode')}
              >
                <Text style={[styles.modeButtonText, scanMode === 'barcode' && styles.modeButtonTextActive]}>
                  Barcode Only
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeButton, scanMode === 'label' && styles.modeButtonActive]}
                onPress={() => setScanMode('label')}
              >
                <Text style={[styles.modeButtonText, scanMode === 'label' && styles.modeButtonTextActive]}>
                  Full Label OCR
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.startButton} onPress={startSession}>
            <Play color="#fff" size={24} />
            <Text style={styles.startButtonText}>Start Batch Session</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isScanning && (
        <View style={styles.scannerContainer}>
          <EnhancedBarcodeScanner
            onScan={handleBarcodeScan}
            onLabelExtracted={handleLabelExtracted}
            mode={scanMode}
            continuous={true}
          />
          
          <View style={styles.scanOverlay}>
            <View style={styles.sessionStats}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{session.packagesScanned}</Text>
                <Text style={styles.statLabel}>Scanned</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#ef4444' }]}>{session.errorsCount}</Text>
                <Text style={styles.statLabel}>Errors</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#10b981' }]}>
                  {session.packagesScanned > 0 ? Math.round((session.packagesScanned - session.errorsCount) / session.packagesScanned * 100) : 0}%
                </Text>
                <Text style={styles.statLabel}>Success</Text>
              </View>
            </View>

            {lastScanResult && lastScanResult.type === 'PALLET_SWITCH' && (
              <View style={[styles.lastScanInfo, { backgroundColor: 'rgba(59,130,246,0.9)' }]}> 
                <CheckCircle color="#fff" size={20} />
                <Text style={styles.lastScanText}>
                  Active Pallet switched → {lastScanResult.palletCode}
                </Text>
              </View>
            )}
            {lastScanResult && !lastScanResult.type && (
              <View style={styles.lastScanInfo}>
                <CheckCircle color="#10b981" size={20} />
                <Text style={styles.lastScanText}>
                  {lastScanResult?.package?.tracking ?? ''} → {lastScanResult?.suggestedPallet?.palletCode ?? activePallet?.palletCode ?? ''}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Top: Current Pallet + Quick Actions */}
      <View style={styles.topBar}>
        <View style={styles.palletBadge}>
          <Text style={styles.palletBadgeLabel}>Current Pallet</Text>
          <Text style={styles.palletBadgeValue} testID="currentPalletValue">
            {activePallet?.palletCode ?? 'None'}
          </Text>
        </View>
        <View style={styles.topActions}>
          <TouchableOpacity
            testID="switchPalletBtn"
            style={styles.topActionBtn}
            onPress={() => setShowPalletModal(true)}
          >
            <RefreshCw color="#1f2937" size={18} />
            <Text style={styles.topActionText}>Switch</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="newPalletBtn"
            style={[styles.topActionBtn, { backgroundColor: '#e0f2f1' }]}
            onPress={() => setShowPalletModal(true)}
          >
            <Plus color="#065f46" size={18} />
            <Text style={[styles.topActionText, { color: '#065f46' }]}>New Pallet</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.controlPanel}>
        <View style={styles.sessionInfo}>
          <Text style={styles.sessionTitle}>Session {session.id.split('-')[1]}</Text>
          <Text style={styles.sessionStatus}>Status: {session.status.toUpperCase()}</Text>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity
            testID="historyBtn"
            style={[styles.controlButton, { backgroundColor: '#eff6ff' }]}
            onPress={() => setShowHistoryModal(true)}
          >
            <History color="#2563eb" size={20} />
            <Text style={[styles.controlButtonText, { color: '#2563eb' }]}>History</Text>
          </TouchableOpacity>
          {session.status === 'active' ? (
            <TouchableOpacity style={styles.controlButton} onPress={pauseSession}>
              <Pause color="#f59e0b" size={20} />
              <Text style={styles.controlButtonText}>Pause</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.controlButton} onPress={resumeSession}>
              <Play color="#10b981" size={20} />
              <Text style={styles.controlButtonText}>Resume</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity style={[styles.controlButton, styles.endButton]} onPress={endSession}>
            <Square color="#ef4444" size={20} />
            <Text style={[styles.controlButtonText, { color: '#ef4444' }]}>End Session</Text>
          </TouchableOpacity>
        </View>

        {errors.length > 0 && (
          <View style={styles.errorsSection}>
            <Text style={styles.errorsTitle}>
              <AlertTriangle color="#f59e0b" size={16} /> Recent Errors ({errors.filter(e => !e.resolved).length})
            </Text>
            <ScrollView style={styles.errorsList} showsVerticalScrollIndicator={false}>
              {errors.slice(-5).map((error) => (
                <TouchableOpacity
                  key={error.id}
                  style={[styles.errorItem, error.resolved && styles.errorItemResolved]}
                  onPress={() => !error.resolved && openErrorCorrection(error)}
                >
                  <View style={styles.errorContent}>
                    <Text style={styles.errorType}>{error.errorType.replace('_', ' ').toUpperCase()}</Text>
                    <Text style={styles.errorMessage}>{error.message}</Text>
                    <Text style={styles.errorTime}>{new Date(error.timestamp).toLocaleTimeString()}</Text>
                  </View>
                  {!error.resolved && (
                    <Edit3 color="#6b7280" size={16} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Switch/New Pallet Modal */}
      <Modal
        visible={showPalletModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPalletModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Switch or Create Pallet</Text>
              <TouchableOpacity onPress={() => setShowPalletModal(false)}>
                <X color="#6b7280" size={24} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.errorDescription}>Scan an LP barcode (LP:LP101001) to switch, or pick from list.</Text>
              <View style={{ maxHeight: 240 }}>
                <ScrollView>
                  {pallets.filter(p => p.state === 'OPEN').map((p: Pallet) => (
                    <TouchableOpacity
                      key={p.id}
                      testID={`palletOption-${p.id}`}
                      style={[styles.palletRow, activePalletId === p.id && styles.palletRowActive]}
                      onPress={async () => {
                        await setActivePalletById(p.id);
                        setShowPalletModal(false);
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.palletRowTitle}>{p.palletCode}</Text>
                        <Text style={styles.palletRowMeta}>Dept {p.department} • {p.dayBucket} • {p.packageCount} pkgs</Text>
                      </View>
                      <ChevronDown color="#6b7280" size={16} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={{ height: 12 }} />
              <Text style={styles.modeSelectorTitle}>Create New Pallet</Text>
              <TextInput
                testID="newPalletNameInput"
                style={styles.correctionInput}
                placeholder="Name/ID (e.g., Inbound-A1)"
                value={newPalletName}
                onChangeText={setNewPalletName}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  testID="createPalletBtn"
                  style={styles.resolveButton}
                  onPress={async () => {
                    if (!newPalletName.trim()) {
                      Alert.alert('Enter a name');
                      return;
                    }
                    const created = await createNamedPallet(newPalletName.trim());
                    setNewPalletName('');
                    await setActivePalletById(created.id);
                    setShowPalletModal(false);
                    Alert.alert(
                      'License Plate',
                      `Pallet ${created.palletCode} created. Print label now?`,
                      [
                        { text: 'No' },
                        { text: 'Yes', onPress: () => printLicensePlate(created.id) },
                      ]
                    );
                  }}
                >
                  <Plus color="#fff" size={18} />
                  <Text style={styles.resolveButtonText}>Create</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="printLPBtn"
                  style={styles.skipButton}
                  onPress={async () => {
                    if (activePalletId) {
                      await printLicensePlate(activePalletId);
                    }
                  }}
                >
                  <Printer color="#6b7280" size={18} />
                  <Text style={styles.skipButtonText}>Print LP</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Error Correction Modal */}
      <Modal
        visible={showErrorModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowErrorModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Correct Error</Text>
              <TouchableOpacity onPress={() => setShowErrorModal(false)}>
                <X color="#6b7280" size={24} />
              </TouchableOpacity>
            </View>
            
            {selectedError && (
              <View style={styles.modalBody}>
                <Text style={styles.errorDescription}>
                  {selectedError.errorType}: {selectedError.message}
                </Text>
                
                <TextInput
                  style={styles.correctionInput}
                  placeholder="Enter correction (tracking, PO, etc.)"
                  value={correctionValue}
                  onChangeText={setCorrectionValue}
                  autoCapitalize="characters"
                />
                
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={styles.resolveButton}
                    onPress={() => resolveError(selectedError.id, correctionValue)}
                  >
                    <CheckCircle color="#fff" size={20} />
                    <Text style={styles.resolveButtonText}>Resolve</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.skipButton}
                    onPress={() => resolveError(selectedError.id, 'Skipped')}
                  >
                    <RotateCcw color="#6b7280" size={20} />
                    <Text style={styles.skipButtonText}>Skip</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* History Modal */}
      <Modal
        visible={showHistoryModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowHistoryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Scan History</Text>
              <TouchableOpacity onPress={() => setShowHistoryModal(false)}>
                <X color="#6b7280" size={24} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.historyFilters}>
                <TouchableOpacity
                  style={[styles.filterPill, historyFilterDate === 'TODAY' && styles.filterPillActive]}
                  onPress={() => setHistoryFilterDate('TODAY')}
                >
                  <Text style={[styles.filterPillText, historyFilterDate === 'TODAY' && styles.filterPillTextActive]}>Today</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterPill, historyFilterDate === 'ALL' && styles.filterPillActive]}
                  onPress={() => setHistoryFilterDate('ALL')}
                >
                  <Text style={[styles.filterPillText, historyFilterDate === 'ALL' && styles.filterPillTextActive]}>All</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.filterPill, historyFilterErrorsOnly && styles.filterPillActive]}
                  onPress={() => setHistoryFilterErrorsOnly(prev => !prev)}
                >
                  <Text style={[styles.filterPillText, historyFilterErrorsOnly && styles.filterPillTextActive]}>Errors</Text>
                </TouchableOpacity>
              </View>
              <View style={{ height: 8 }} />
              <ScrollView style={{ maxHeight: 380 }}>
                {filteredEvents.map((e) => (
                  <View key={e.id} style={styles.historyRow}>
                    <Text style={styles.historyMain}>{e.eventType.replaceAll('_', ' ')}</Text>
                    <Text style={styles.historySub}>{e.tracking ?? e.palletCode ?? ''}</Text>
                    <Text style={styles.historyTime}>{e.timestamp}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  welcomeCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  welcomeDescription: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  modeSelector: {
    width: '100%',
    marginBottom: 32,
  },
  modeSelectorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  modeButtons: {
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    padding: 4,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 6,
  },
  modeButtonActive: {
    backgroundColor: '#10b981',
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  modeButtonTextActive: {
    color: '#fff',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  scannerContainer: {
    flex: 1,
    position: 'relative',
  },
  scanOverlay: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
  },
  sessionStats: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  lastScanInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  lastScanText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  topBar: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  palletBadge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  palletBadgeLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  palletBadgeValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  topActions: {
    flexDirection: 'row',
    gap: 8,
  },
  topActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f3f4f6',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  topActionText: {
    color: '#1f2937',
    fontSize: 14,
    fontWeight: '600',
  },
  controlPanel: {
    backgroundColor: '#fff',
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  sessionInfo: {
    marginBottom: 16,
  },
  sessionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  sessionStatus: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  controls: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  controlButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  controlButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  endButton: {
    backgroundColor: '#fef2f2',
  },
  errorsSection: {
    maxHeight: 200,
  },
  errorsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorsList: {
    maxHeight: 150,
  },
  errorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  errorItemResolved: {
    backgroundColor: '#f0fdf4',
    opacity: 0.7,
  },
  errorContent: {
    flex: 1,
  },
  errorType: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ef4444',
    marginBottom: 2,
  },
  errorMessage: {
    fontSize: 14,
    color: '#111827',
    marginBottom: 2,
  },
  errorTime: {
    fontSize: 12,
    color: '#6b7280',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  modalBody: {
    padding: 16,
  },
  errorDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  correctionInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  modalActions: {
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
  palletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  palletRowActive: {
    backgroundColor: '#ecfeff',
    borderWidth: 1,
    borderColor: '#06b6d4',
  },
  palletRowTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  palletRowMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  historyFilters: {
    flexDirection: 'row',
    gap: 8,
  },
  filterPill: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  filterPillActive: {
    backgroundColor: '#2563eb',
  },
  filterPillText: {
    color: '#1f2937',
    fontSize: 12,
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: '#ffffff',
  },
  historyRow: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  historyMain: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  historySub: {
    fontSize: 12,
    color: '#6b7280',
  },
  historyTime: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
});