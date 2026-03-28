import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  ScrollView, 
  TextInput,
  Alert,
  Modal,
  Platform
} from 'react-native';
import { 
  GraduationCap, 
  Camera, 
  CheckCircle, 
  X, 
  Edit3, 
  Save,
  AlertCircle,
  RotateCcw
} from 'lucide-react-native';
import { EnhancedBarcodeScanner } from '@/components/EnhancedBarcodeScanner';
import { TrainingData, LabelExtractionResult } from '@/types/warehouse';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseLabel } from '@/lib/parsers/labelParser';
import { postTrainingScan, postTrainingVerify } from '@/lib/api/training';

export default function TrainingModeScreen() {
  const [isTraining, setIsTraining] = useState(false);
  const [trainingData, setTrainingData] = useState<TrainingData[]>([]);
  const [currentSample, setCurrentSample] = useState<TrainingData | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [freezeFrameUri, setFreezeFrameUri] = useState<string | null>(null);
  const [corrections, setCorrections] = useState({
    tracking: '',
    poNumber: '',
    reference: '',
    vendor: ''
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState('');
  const lastAcceptedRef = React.useRef<{ tracking?: string; at: number } | null>(null);

  useEffect(() => {
    loadTrainingData();
  }, []);

  const loadTrainingData = async () => {
    try {
      const stored = await AsyncStorage.getItem('training_data');
      if (stored) {
        setTrainingData(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading training data:', error);
    }
  };

  const saveTrainingData = async (data: TrainingData[]) => {
    try {
      await AsyncStorage.setItem('training_data', JSON.stringify(data));
      setTrainingData(data);
    } catch (error) {
      console.error('Error saving training data:', error);
    }
  };

  const startTraining = () => {
    setIsTraining(true);
    console.log('Started training mode');
  };

  const stopTraining = () => {
    setIsTraining(false);
    setCurrentSample(null);
    console.log('Stopped training mode');
  };

  const handleLabelExtracted = async (payload: LabelExtractionResult) => {
    if (isProcessing || showResultModal || showCorrectionModal) {
      console.log('Training: Ignoring scan - already processing or modal open');
      return;
    }

    console.log('Training: onLabelExtracted payload', payload);
    const startTime = Date.now();
    setIsProcessing(true);
    setProcessingProgress('Analyzing image...');
    setFreezeFrameUri(payload.imageUri ?? null);
    
    try {
      setProcessingProgress('Parsing label data...');
      const parsed = parseLabel(payload.rawBarcodes ?? [], payload.ocrLines ?? [], payload.imageUri ?? '');
      
      // De-duplicate same tracking within 5 seconds
      if (parsed.tracking && lastAcceptedRef.current && lastAcceptedRef.current.tracking === parsed.tracking) {
        const since = Date.now() - lastAcceptedRef.current.at;
        if (since < 5000) {
          console.log('De-dupe: ignoring same tracking within 5s');
          setIsProcessing(false);
          setProcessingProgress('');
          return;
        }
      }
      
      // Validate critical fields - reject if no tracking or PO
      const hasValidTracking = !!parsed.tracking && (
        (parsed.carrier === 'UPS' && /^1Z[A-Z0-9]{16}$/.test(parsed.tracking)) ||
        (parsed.carrier === 'FEDEX' && /^\d{12,22}$/.test(parsed.tracking)) ||
        (parsed.carrier === 'UNKNOWN' && parsed.tracking.length >= 8)
      );
      
      const hasValidPO = !!parsed.poNumber && parsed.poNumber.length >= 3;
      
      if (!hasValidTracking) {
        console.log('REJECTED: Invalid tracking number');
        Alert.alert(
          'Scan Rejected - Invalid Tracking',
          `Could not find a valid tracking number.\n\nExpected: UPS (1Z...) or FedEx (12-22 digits)\nFound: ${parsed.tracking || 'None'}\n\nPlease ensure the tracking barcode is clearly visible and try again.`,
          [{ text: 'OK' }]
        );
        setIsProcessing(false);
        setProcessingProgress('');
        setTimeout(() => setFreezeFrameUri(null), 200);
        return;
      }
      
      if (!hasValidPO) {
        console.log('REJECTED: Missing PO number');
        Alert.alert(
          'Scan Rejected - Missing PO', 
          `Missing PO number. Please ensure the PO field is clearly visible.\n\nFound: ${parsed.poNumber || 'None'}\n\nTry repositioning the label and scan again.`,
          [{ text: 'OK' }]
        );
        setIsProcessing(false);
        setProcessingProgress('');
        setTimeout(() => setFreezeFrameUri(null), 200);
        return;
      }
      
      // Optional API lookup
      setProcessingProgress('Checking database...');
      try {
        const resp = await postTrainingScan(parsed);
        if (resp && typeof resp === 'object') {
          if (resp.lookup) (parsed as any).lookup = resp.lookup;
          if (typeof resp.confidence === 'number') parsed.confidence = Math.max(parsed.confidence, resp.confidence);
        }
      } catch {
        console.log('postTrainingScan failed, continue offline');
      }
      
      const sample: TrainingData = {
        id: `training-${Date.now()}`,
        imageUri: parsed.imageUri || '',
        extractedData: {
          carrier: parsed.carrier,
          tracking: parsed.tracking,
          poNumber: parsed.poNumber,
          reference: parsed.reference,
          ref1Prefix: parsed.ref1Prefix,
          ref1Id: parsed.ref1Id,
          ref2: parsed.ref2,
          bottomRaw: parsed.bottomRaw,
          packageBaseId: parsed.packageBaseId,
          cartonIndex: parsed.cartonIndex,
          flags: parsed.flags,
        },
        confidence: parsed.confidence,
        timestamp: new Date().toISOString(),
        status: parsed.confidence >= 0.8 ? 'verified' : 'pending',
        rawBarcodes: payload.rawBarcodes ?? [],
        ocrLines: payload.ocrLines ?? [],
        ocrText: (payload.ocrLines ?? []).map(l => l.text).join(' '),
        lookup: (parsed as any).lookup,
      };
      
      const totalTime = Date.now() - startTime;
      console.log(`Training processing completed in ${totalTime}ms`);
      
      setCurrentSample(sample);
      lastAcceptedRef.current = { tracking: sample.extractedData.tracking, at: Date.now() };
      setShowResultModal(true);
      
    } catch (err) {
      console.log('handleLabelExtracted error', err);
    } finally {
      setIsProcessing(false);
      setProcessingProgress('');
      setTimeout(() => setFreezeFrameUri(null), 200);
    }
  };

  const saveSample = (sample: TrainingData) => {
    const updatedData = [...trainingData, sample];
    saveTrainingData(updatedData);
  };

  const handleAcceptSample = () => {
    if (!currentSample) return;
    saveSample(currentSample);
    setShowResultModal(false);
    setCurrentSample(null);
  };

  const handleCorrectSample = () => {
    if (!currentSample) return;
    setCorrections({
      tracking: currentSample.extractedData.tracking || '',
      poNumber: currentSample.extractedData.poNumber || '',
      reference: currentSample.extractedData.reference || '',
      vendor: ''
    });
    setShowResultModal(false);
    setShowCorrectionModal(true);
  };

  const handleRetryScan = () => {
    setShowResultModal(false);
    setCurrentSample(null);
  };

  const openCorrectionModal = (sample: TrainingData) => {
    setCurrentSample(sample);
    setCorrections({
      tracking: sample.extractedData.tracking || '',
      poNumber: sample.extractedData.poNumber || '',
      reference: sample.extractedData.reference || '',
      vendor: sample.extractedData.vendor || ''
    });
    setShowCorrectionModal(true);
  };

  const saveCorrections = async () => {
    if (!currentSample) return;
    const corrected: TrainingData = {
      ...currentSample,
      correctedData: {
        ...currentSample.extractedData,
        tracking: corrections.tracking || currentSample.extractedData.tracking,
        poNumber: corrections.poNumber || currentSample.extractedData.poNumber,
        reference: corrections.reference || currentSample.extractedData.reference,
      },
      status: 'corrected'
    };
    
    try { 
      await postTrainingVerify(corrected.id, corrected.correctedData as any); 
    } catch {
      // Ignore API errors
    }
    
    saveSample(corrected);
    setShowCorrectionModal(false);
    setCurrentSample(null);
  };

  const deleteSample = (sampleId: string) => {
    Alert.alert(
      'Delete Sample',
      'Are you sure you want to delete this training sample?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => {
            const updatedData = trainingData.filter(d => d.id !== sampleId);
            saveTrainingData(updatedData);
          }
        }
      ]
    );
  };

  const getTrainingStats = () => {
    const total = trainingData.length;
    const verified = trainingData.filter(d => d.status === 'verified').length;
    const corrected = trainingData.filter(d => d.status === 'corrected').length;
    const avgConfidence = total > 0 
      ? trainingData.reduce((sum, d) => sum + d.confidence, 0) / total 
      : 0;

    return { total, verified, corrected, avgConfidence };
  };

  const stats = getTrainingStats();

  if (isTraining) {
    return (
      <View style={styles.container}>
        <EnhancedBarcodeScanner
          onScan={() => {}} // Not used in training mode
          onLabelExtracted={handleLabelExtracted}
          mode="training"
        />
        
        <View style={styles.trainingOverlay}>
          <View style={styles.trainingHeader}>
            <Text style={styles.trainingTitle}>Training Mode</Text>
            <Text style={styles.trainingSubtitle}>
              Scan one label at a time for training
            </Text>
            <Text style={styles.trainingInstructions}>
              {isProcessing ? (processingProgress || 'Processing...') : 'Point camera at a UPS or FedEx label'}
            </Text>
            {isProcessing && (
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View style={styles.progressFill} />
                </View>
                <Text style={styles.progressText}>Processing under 5 seconds...</Text>
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.stopButton} onPress={stopTraining}>
            <X color="#fff" size={20} />
            <Text style={styles.stopButtonText}>Stop Training</Text>
          </TouchableOpacity>
        </View>

        {/* Result Modal */}
        <Modal
          visible={showResultModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowResultModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.resultModalContent}>
              {currentSample && (
                <View style={[styles.resultBanner, currentSample.confidence >= 0.8 ? styles.bannerGood : styles.bannerBad]}>
                  {currentSample.confidence >= 0.8 ? (
                    <CheckCircle color="#065f46" size={28} />
                  ) : (
                    <X color="#7f1d1d" size={28} />
                  )}
                  <Text style={[styles.resultBannerText, currentSample.confidence >= 0.8 ? styles.resultBannerTextGood : styles.resultBannerTextBad]}>
                    {currentSample.confidence >= 0.8 ? 'Good Scan' : 'Needs Correction'}
                  </Text>
                  <View style={styles.confidenceBadge}>
                    <Text style={styles.confidenceText}>
                      {(currentSample.confidence * 100).toFixed(1)}%
                    </Text>
                  </View>
                </View>
              )}

              <ScrollView style={styles.resultBody}>
                {currentSample && (
                  <>
                    {currentSample.imageUri ? (
                      <View style={styles.previewFrame}>
                        <View style={styles.previewHeader}> 
                          <Text style={styles.sectionTitle}>Captured Frame</Text>
                        </View>
                        <View style={styles.previewImageWrap}>
                          <View style={styles.previewAspect} />
                          <View style={styles.previewAbsolute}> 
                            <Text style={styles.previewPlaceholder} testID="image-uri-text">{currentSample.imageUri}</Text>
                          </View>
                        </View>
                      </View>
                    ) : null}

                    <View style={styles.extractedDataSection}>
                      <Text style={styles.sectionTitle}>Extracted Fields</Text>
                      
                      <View style={[styles.dataRow, !currentSample.extractedData.tracking && styles.dataRowError]}>
                        <Text style={styles.dataLabel}>Tracking</Text>
                        <Text style={[styles.dataValue, !currentSample.extractedData.tracking && styles.dataValueError]}>
                          {currentSample.extractedData.tracking || 'Not detected'}
                        </Text>
                      </View>
                      
                      <View style={[styles.dataRow, !(currentSample.extractedData.poNumber || currentSample.extractedData.ref2) && styles.dataRowError]}>
                        <Text style={styles.dataLabel}>PO Number</Text>
                        <Text style={[styles.dataValue, !(currentSample.extractedData.poNumber || currentSample.extractedData.ref2) && styles.dataValueError]}>
                          {currentSample.extractedData.poNumber || 'Not detected'}
                        </Text>
                      </View>
                      
                      <View style={styles.dataRow}>
                        <Text style={styles.dataLabel}>REF1</Text>
                        <Text style={styles.dataValue}>
                          {currentSample.extractedData.reference || '—'}
                        </Text>
                      </View>
                      
                      {currentSample.extractedData.ref2 && (
                        <View style={styles.dataRow}>
                          <Text style={styles.dataLabel}>REF2</Text>
                          <Text style={styles.dataValue}>
                            {currentSample.extractedData.ref2}
                          </Text>
                        </View>
                      )}

                      {currentSample.extractedData.bottomRaw && (
                        <View style={styles.dataRow}>
                          <Text style={styles.dataLabel}>Bottom Code</Text>
                          <Text style={styles.dataValue}>
                            {currentSample.extractedData.bottomRaw}
                          </Text>
                        </View>
                      )}

                      <View style={styles.issuesBox}>
                        <Text style={styles.issuesTitle}>Scan Assessment</Text>
                        {(!currentSample.extractedData.tracking) && (
                          <Text style={styles.issueItem}>• Tracking not detected</Text>
                        )}
                        {!(currentSample.extractedData.poNumber || currentSample.extractedData.ref2) && (
                          <Text style={styles.issueItem}>• PO/REF2 missing</Text>
                        )}
                        {!currentSample.extractedData.bottomRaw && (
                          <Text style={styles.issueItemMuted}>• Bottom carton code not found (optional)</Text>
                        )}
                      </View>
                    </View>

                    <View style={styles.debugSection}>
                      <Text style={styles.sectionTitle}>Debug</Text>
                      <Text style={styles.debugText}>
                        Barcodes: {(currentSample.rawBarcodes || []).length}
                      </Text>
                      <Text style={styles.debugText}>
                        OCR Lines: {(currentSample.ocrLines || []).length}
                      </Text>
                      {currentSample.ocrText && (
                        <Text style={styles.debugText} numberOfLines={4}>
                          {currentSample.ocrText}
                        </Text>
                      )}
                    </View>
                  </>
                )}
              </ScrollView>

              <View style={styles.resultActions}>
                <TouchableOpacity style={styles.retryButton} onPress={handleRetryScan} testID="retry-scan">
                  <RotateCcw color="#6b7280" size={20} />
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.correctButton} onPress={handleCorrectSample} testID="correct-scan">
                  <Edit3 color="#f59e0b" size={20} />
                  <Text style={styles.correctButtonText}>Correct</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={[styles.acceptButton, currentSample && currentSample.confidence < 0.8 && styles.acceptButtonDisabled]} onPress={handleAcceptSample} disabled={!!currentSample && currentSample.confidence < 0.8} testID="accept-scan">
                  <CheckCircle color="#fff" size={20} />
                  <Text style={styles.acceptButtonText}>Accept</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <GraduationCap color="#10b981" size={48} />
        <Text style={styles.title}>Training Mode</Text>
        <Text style={styles.description}>
          Improve OCR accuracy by training the system with real UPS labels
        </Text>
      </View>

      <View style={styles.statsCard}>
        <Text style={styles.statsTitle}>Training Progress</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total Samples</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#10b981' }]}>{stats.verified}</Text>
            <Text style={styles.statLabel}>Verified</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#f59e0b' }]}>{stats.corrected}</Text>
            <Text style={styles.statLabel}>Corrected</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: '#3b82f6' }]}>
              {(stats.avgConfidence * 100).toFixed(1)}%
            </Text>
            <Text style={styles.statLabel}>Avg Confidence</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.startButton} onPress={startTraining}>
        <Camera color="#fff" size={24} />
        <Text style={styles.startButtonText}>Start Training Session</Text>
      </TouchableOpacity>

      {trainingData.length > 0 && (
        <View style={styles.samplesSection}>
          <Text style={styles.mainSectionTitle}>Training Samples</Text>
          {trainingData.slice(-10).reverse().map((sample) => (
            <View key={sample.id} style={styles.sampleCard}>
              <View style={styles.sampleHeader}>
                <View style={styles.sampleInfo}>
                  <Text style={styles.sampleId}>
                    Sample {sample.id.split('-')[1]}
                  </Text>
                  <Text style={styles.sampleTime}>
                    {new Date(sample.timestamp).toLocaleString()}
                  </Text>
                </View>
                <View style={styles.sampleStatus}>
                  {sample.status === 'verified' && (
                    <CheckCircle color="#10b981" size={20} />
                  )}
                  {sample.status === 'corrected' && (
                    <Edit3 color="#f59e0b" size={20} />
                  )}
                  {sample.status === 'pending' && (
                    <AlertCircle color="#ef4444" size={20} />
                  )}
                  <Text style={styles.sampleConfidenceText}>
                    {(sample.confidence * 100).toFixed(1)}%
                  </Text>
                </View>
              </View>

              <View style={styles.sampleDetails}>
                <View style={styles.dataComparison}>
                  <View style={styles.dataColumn}>
                    <Text style={styles.dataColumnTitle}>Extracted</Text>
                    <Text style={styles.dataField}>
                      📦 {sample.extractedData.tracking || 'N/A'}
                    </Text>
                    <Text style={styles.dataField}>
                      📋 {sample.extractedData.poNumber || 'N/A'}
                    </Text>
                    <Text style={styles.dataField}>
                      🏷️ {sample.extractedData.reference || 'N/A'}
                    </Text>
                    <Text style={styles.dataField}>
                      🏢 {sample.extractedData.vendor || 'N/A'}
                    </Text>
                  </View>
                  
                  {sample.status === 'corrected' && (
                    <View style={styles.dataColumn}>
                      <Text style={styles.dataColumnTitle}>Corrected</Text>
                      <Text style={styles.dataField}>
                        📦 {sample.correctedData?.tracking ?? 'N/A'}
                      </Text>
                      <Text style={styles.dataField}>
                        📋 {sample.correctedData?.poNumber ?? 'N/A'}
                      </Text>
                      <Text style={styles.dataField}>
                        🏷️ {sample.correctedData?.reference ?? 'N/A'}
                      </Text>
                      <Text style={styles.dataField}>
                        🏢 {sample.correctedData?.vendor ?? 'N/A'}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.sampleActions}>
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => openCorrectionModal(sample)}
                  >
                    <Edit3 color="#6b7280" size={16} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => deleteSample(sample.id)}
                  >
                    <X color="#ef4444" size={16} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Correction Modal */}
      <Modal
        visible={showCorrectionModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCorrectionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Correct Extraction</Text>
              <Text style={styles.modalSubtitle}>Fix any incorrect values</Text>
            </View>
            
            <ScrollView style={styles.modalBody}>
              <Text style={styles.fieldLabel}>Tracking Number</Text>
              <TextInput
                style={styles.correctionInput}
                placeholder="1Z..."
                value={corrections.tracking}
                onChangeText={(text) => setCorrections({...corrections, tracking: text})}
                autoCapitalize="characters"
              />

              <Text style={styles.fieldLabel}>PO Number</Text>
              <TextInput
                style={styles.correctionInput}
                placeholder="PO123456"
                value={corrections.poNumber}
                onChangeText={(text) => setCorrections({...corrections, poNumber: text})}
                autoCapitalize="characters"
              />

              <Text style={styles.fieldLabel}>Reference</Text>
              <TextInput
                style={styles.correctionInput}
                placeholder="REF1234"
                value={corrections.reference}
                onChangeText={(text) => setCorrections({...corrections, reference: text})}
                autoCapitalize="characters"
              />

              <Text style={styles.fieldLabel}>Vendor</Text>
              <TextInput
                style={styles.correctionInput}
                placeholder="Vendor Name"
                value={corrections.vendor}
                onChangeText={(text) => setCorrections({...corrections, vendor: text})}
              />
              
              {currentSample?.ocrText && (
                <View style={styles.ocrPreview}>
                  <Text style={styles.fieldLabel}>Raw OCR Text (for reference):</Text>
                  <Text style={styles.ocrPreviewText}>{currentSample.ocrText}</Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.correctionActions}>
              <TouchableOpacity 
                style={styles.cancelCorrectionButton} 
                onPress={() => {
                  setShowCorrectionModal(false);
                  setCurrentSample(null);
                }}
              >
                <X color="#6b7280" size={20} />
                <Text style={styles.cancelCorrectionButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.saveButton} onPress={saveCorrections}>
                <Save color="#fff" size={20} />
                <Text style={styles.saveButtonText}>Save & Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  content: {
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  statsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
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
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 24,
    gap: 8,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  trainingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  trainingHeader: {
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  trainingTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  trainingSubtitle: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  trainingInstructions: {
    color: '#d1d5db',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
  currentSample: {
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sampleTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  sampleConfidence: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 8,
  },
  sampleData: {
    gap: 4,
  },
  sampleField: {
    color: '#fff',
    fontSize: 12,
  },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  stopButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  samplesSection: {
    marginTop: 8,
  },
  mainSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  sampleCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  sampleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sampleInfo: {
    flex: 1,
  },
  sampleId: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  sampleTime: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  sampleStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sampleConfidenceText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  sampleDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  dataComparison: {
    flex: 1,
    flexDirection: 'row',
    gap: 16,
  },
  dataColumn: {
    flex: 1,
  },
  dataColumnTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
  },
  dataField: {
    fontSize: 12,
    color: '#111827',
    marginBottom: 2,
  },
  sampleActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
  },
  deleteButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#fef2f2',
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
    maxHeight: '80%',
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
    maxHeight: 300,
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
  },
  modalActions: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  ocrSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.3)',
  },
  ocrTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  ocrText: {
    color: '#fff',
    fontSize: 10,
    opacity: 0.8,
    lineHeight: 14,
  },
  ocrPreview: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  ocrPreviewText: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
    maxHeight: 80,
  },
  previewFrame: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  previewHeader: {
    marginBottom: 8,
  },
  previewImageWrap: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  previewAspect: {
    width: '100%',
    paddingTop: 56,
  },
  previewAbsolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewPlaceholder: {
    fontSize: 10,
    color: '#9ca3af',
  },
  resultModalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 460,
    maxHeight: '90%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  resultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  bannerGood: {
    backgroundColor: '#d1fae5',
  },
  bannerBad: {
    backgroundColor: '#fee2e2',
  },
  resultBannerText: {
    fontSize: 18,
    fontWeight: '700',
  },
  resultBannerTextGood: {
    color: '#065f46',
  },
  resultBannerTextBad: {
    color: '#7f1d1d',
  },
  confidenceBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  resultBody: {
    maxHeight: 560,
  },
  extractedDataSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    paddingVertical: 6,
  },
  dataRowError: {
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    paddingHorizontal: 8,
  },
  dataLabel: {
    fontSize: 16,
    color: '#374151',
    flex: 1,
    marginRight: 12,
    fontWeight: '600',
  },
  dataValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    flex: 2,
    textAlign: 'right',
  },
  dataValueError: {
    color: '#b91c1c',
  },
  debugSection: {
    padding: 20,
  },
  issuesBox: {
    marginTop: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  issuesTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  issueItem: {
    fontSize: 12,
    color: '#b91c1c',
    marginBottom: 2,
  },
  issueItemMuted: {
    fontSize: 12,
    color: '#6b7280',
  },
  debugText: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
    lineHeight: 16,
  },
  resultActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  retryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 6,
  },
  retryButtonText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '600',
  },
  correctButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef3c7',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f59e0b',
    gap: 6,
  },
  correctButtonText: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '600',
  },
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  acceptButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  correctionActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  cancelCorrectionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9fafb',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 6,
  },
  cancelCorrectionButtonText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '600',
  },
  progressContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
  progressBar: {
    width: '80%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10b981',
    width: '100%',
    borderRadius: 2,
  },
  progressText: {
    color: '#9ca3af',
    fontSize: 10,
    textAlign: 'center',
  },
});