import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, ScrollView, Platform, Modal, TextInput, useWindowDimensions } from 'react-native';
import { Camera, Package, Check, X, Printer, AlertTriangle, CheckCircle, Info, Zap, Plus, Search as SearchIcon, Edit3, Copy } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { useWarehouse } from '@/providers/warehouse-provider';
import { EnhancedBarcodeScanner } from '@/components/EnhancedBarcodeScanner';
import { parseLabel } from '@/lib/parsers/labelParser';
import { ParsedLabelPayload, LabelExtractionResult } from '@/types/warehouse';
import { useScan } from '@/providers/scan-provider';

export default function ScanScreen() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(true);
  const { flags, deviceMode } = useScan();
  const [scannedData, setScannedData] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showManualAssignment, setShowManualAssignment] = useState(false);
  const [showMissingPOModal, setShowMissingPOModal] = useState(false);
  const [poInput, setPoInput] = useState<string>('');
  const [palletSearch, setPalletSearch] = useState<string>('');
  const [frozenImage, setFrozenImage] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<'good' | 'bad' | null>(null);
  const [parsedLabel, setParsedLabel] = useState<ParsedLabelPayload | null>(null);
  const [scanMode, setScanMode] = useState<'label' | 'barcode'>('barcode');
  const [showEditDetails, setShowEditDetails] = useState(false);
  const [trackingInput, setTrackingInput] = useState<string>('');
  const [carrierInput, setCarrierInput] = useState<'UPS' | 'FEDEX' | 'UNKNOWN'>('UNKNOWN');
  const [showPOEntry, setShowPOEntry] = useState(false);
  const [showPOOCR, setShowPOOCR] = useState(false);
  const [poOcrResult, setPoOcrResult] = useState<string>('');
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const frameWidth = Math.min(windowWidth - 40, 360);
  const frameHeight = frameWidth * 1.5;
  const { processPackageScan, assignToPallet, generatePalletBarcode, pallets, lookupPackageInApi, createPallet } = useWarehouse();

  useEffect(() => {
    requestCameraPermission();
  }, []);

  const requestCameraPermission = async () => {
    // For Skorpio X5 and other hardware scanners, we don't need camera permission
    if (deviceMode === 'skorpio-x5' || deviceMode === 'external-wedge') {
      setHasPermission(true);
      return;
    }
    // For web and mobile camera mode
    setHasPermission(true);
  };

  const handleLabelExtracted = async (result: LabelExtractionResult) => {
    if (isProcessing) return;

    setIsProcessing(true);
    setFrozenImage(result.imageUri || null);

    console.log('=== SINGLE SCAN PROCESSING ===');
    console.log('Raw scanner result:', {
      barcodes: result.rawBarcodes?.length || 0,
      ocrLines: result.ocrLines?.length || 0,
      imageUri: !!result.imageUri,
    });

    try {
      const parsed = parseLabel(result.rawBarcodes || [], result.ocrLines || [], result.imageUri);
      setParsedLabel(parsed);
      setTrackingInput(parsed.tracking ?? '');
      setCarrierInput((parsed.carrier as 'UPS' | 'FEDEX' | 'UNKNOWN') ?? 'UNKNOWN');

      console.log('Parsed result:', {
        tracking: parsed.tracking,
        poNumber: parsed.poNumber,
        carrier: parsed.carrier,
        confidence: parsed.confidence,
      });

      const hasValidTracking = !!parsed.tracking && (
        (parsed.carrier === 'UPS' && /^1Z[A-Z0-9]{16}$/.test(parsed.tracking)) ||
        (parsed.carrier === 'FEDEX' && /^\d{12,22}$/.test(parsed.tracking)) ||
        (parsed.carrier === 'UNKNOWN' && parsed.tracking.length >= 8)
      );

      const hasValidPO = !!parsed.poNumber && parsed.poNumber.length >= 3;

      console.log('Validation:', { hasValidTracking, hasValidPO, confidence: parsed.confidence });

      if (!hasValidTracking) {
        console.log('REJECTED: Invalid tracking number');
        setScanResult('bad');
        setTimeout(() => {
          Alert.alert(
            'Scan Rejected - Invalid Tracking',
            `Could not find a valid tracking number.\n\nExpected: UPS (1Z...) or FedEx (12-22 digits)\nFound: ${parsed.tracking || 'None'}\n\nPlease ensure the tracking barcode is clearly visible and try again.`,
            [{ text: 'Retry Scan', onPress: resetScan }]
          );
        }, 1200);
        return;
      }

      if (!hasValidPO) {
        console.log('MISSING PO: Prompting for manual entry');
        setScanResult('bad');
        setTimeout(() => {
          setParsedLabel(parsed);
          setShowMissingPOModal(true);
        }, 1200);
        return;
      }

      setScanResult('good');
      await new Promise((resolve) => setTimeout(resolve, 900));

      setShowEditDetails(true);
      console.log('Awaiting user confirmation for tracking/carrier before DB lookup');
    } catch (error) {
      console.error('Error processing label:', error);
      setScanResult('bad');
      setTimeout(() => {
        Alert.alert(
          'Processing Error',
          'Failed to process the scanned label. Please ensure the label is clearly visible and try again.',
          [{ text: 'OK', onPress: resetScan }]
        );
      }, 800);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBarcodeOnlyScan = useCallback((data: string) => {
    if (!data) return;
    console.log('Barcode-only scan received:', data);
    setFrozenImage(null);
    setScanResult(null);
    const initialCarrier: 'UPS' | 'FEDEX' | 'UNKNOWN' = /^1Z[A-Z0-9]{16}$/i.test(data)
      ? 'UPS'
      : /^\d{12,22}$/.test(data)
      ? 'FEDEX'
      : 'UNKNOWN';
    const payload: ParsedLabelPayload = {
      tracking: String(data).toUpperCase(),
      poNumber: undefined,
      carrier: initialCarrier,
      confidence: 0.99,
      reference: undefined,
      imageUri: undefined,
    } as ParsedLabelPayload;
    setParsedLabel(payload);
    setTrackingInput(payload.tracking ?? '');
    setCarrierInput(payload.carrier as 'UPS' | 'FEDEX' | 'UNKNOWN');
    setShowPOEntry(true);
  }, []);

  const resetScan = () => {
    setScannedData(null);
    setFrozenImage(null);
    setScanResult(null);
    setParsedLabel(null);
    setShowManualAssignment(false);
    setShowMissingPOModal(false);
    setShowPOEntry(false);
    setShowPOOCR(false);
    setPoInput('');
    setPoOcrResult('');
    setIsProcessing(false);
  };

  const handleManualPalletAssignment = async (palletId: string) => {
    if (!parsedLabel?.tracking) {
      console.log('No tracking number available for assignment');
      Alert.alert('Assignment Error', 'No tracking number available. Please scan a package first.');
      return;
    }

    console.log('=== MANUAL PALLET ASSIGNMENT ===');
    console.log('Tracking:', parsedLabel.tracking);
    console.log('Target Pallet ID:', palletId);
    console.log('Available pallets:', pallets.map(p => ({ id: p.id, code: p.palletCode })));

    try {
      // First, process the package to create it in the system
      console.log('Processing package scan for:', parsedLabel.tracking);
      const processResult = await processPackageScan(parsedLabel.tracking);
      console.log('Process result:', {
        hasResult: !!processResult,
        hasPackage: !!processResult?.package,
        packageId: processResult?.package?.id,
        hasPallet: !!processResult?.suggestedPallet,
        palletId: processResult?.suggestedPallet?.id
      });
      
      // Validate the process result
      if (!processResult) {
        console.error('Process result is null/undefined');
        Alert.alert('Assignment Error', 'Failed to process package. Please try scanning again.');
        return;
      }
      
      if (!processResult.package) {
        console.error('Process result missing package object');
        Alert.alert('Assignment Error', 'Package data is missing. Please try scanning again.');
        return;
      }
      
      if (!processResult.package.id) {
        console.error('Process result package missing ID');
        Alert.alert('Assignment Error', 'Package ID is missing. Please try scanning again.');
        return;
      }
      
      // Validate the target pallet exists
      const targetPallet = pallets.find(p => p.id === palletId);
      if (!targetPallet) {
        console.error('Target pallet not found:', palletId);
        Alert.alert('Assignment Error', 'Selected pallet not found. Please try again.');
        return;
      }
      
      console.log('Attempting assignment:', {
        packageId: processResult.package.id,
        palletId: palletId,
        palletCode: targetPallet.palletCode
      });
      
      // Perform the assignment
      const success = await assignToPallet(processResult.package.id, palletId);
      console.log('Assignment result:', success);

      if (success) {
        console.log('Assignment successful');
        Alert.alert(
          'Package Assigned',
          `Package ${parsedLabel.tracking} has been assigned to pallet ${targetPallet.palletCode}`,
          [{ text: 'Continue Scanning', onPress: resetScan }]
        );
        setShowManualAssignment(false);
      } else {
        console.error('Assignment returned false');
        Alert.alert(
          'Assignment Failed', 
          'Could not assign package to the selected pallet. Please check the logs and try again.'
        );
      }
    } catch (error) {
      console.error('Manual assignment error:', error);
      Alert.alert(
        'Assignment Error', 
        `Failed to assign package to pallet: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  };

  const handleAssignPallet = async (autoNext?: boolean) => {
    console.log('=== ASSIGN TO SUGGESTED PALLET ===');
    console.log('Scanned Data exists:', !!scannedData);
    
    if (!scannedData) {
      console.error('No scanned data available for assignment');
      Alert.alert('Assignment Error', 'No package data available. Please scan a package first.');
      return;
    }

    console.log('Scanned Data validation:', {
      hasPackage: !!scannedData.package,
      packageId: scannedData.package?.id,
      packageTracking: scannedData.package?.tracking,
      hasSuggestedPallet: !!scannedData.suggestedPallet,
      suggestedPalletId: scannedData.suggestedPallet?.id,
      suggestedPalletCode: scannedData.suggestedPallet?.palletCode
    });

    // Validate required data with detailed error messages
    if (!scannedData.package) {
      console.error('Missing package data in scannedData');
      Alert.alert('Assignment Error', 'Package information is missing. Please scan the package again.');
      return;
    }

    if (!scannedData.package.id) {
      console.error('Missing package ID in scannedData.package');
      Alert.alert('Assignment Error', 'Package ID is missing. Please scan the package again.');
      return;
    }

    if (!scannedData.suggestedPallet) {
      console.error('Missing suggested pallet data in scannedData');
      Alert.alert('Assignment Error', 'Pallet information is missing. Please try manual assignment.');
      setShowManualAssignment(true);
      return;
    }

    if (!scannedData.suggestedPallet.id) {
      console.error('Missing suggested pallet ID in scannedData.suggestedPallet');
      Alert.alert('Assignment Error', 'Pallet ID is missing. Please try manual assignment.');
      setShowManualAssignment(true);
      return;
    }

    // Verify the pallet exists in the current pallets list
    const targetPallet = pallets.find(p => p.id === scannedData.suggestedPallet.id);
    if (!targetPallet) {
      console.error('Suggested pallet not found in pallets list:', scannedData.suggestedPallet.id);
      console.log('Available pallets:', pallets.map(p => ({ id: p.id, code: p.palletCode })));
      Alert.alert('Assignment Error', 'Suggested pallet not found. Please try manual assignment.');
      setShowManualAssignment(true);
      return;
    }

    try {
      console.log('Attempting assignment:', {
        packageId: scannedData.package.id,
        palletId: scannedData.suggestedPallet.id,
        tracking: scannedData.package.tracking,
        palletCode: scannedData.suggestedPallet.palletCode
      });
      
      // Assign to the suggested pallet directly
      const success = await assignToPallet(scannedData.package.id, scannedData.suggestedPallet.id);
      console.log('Assignment result:', success);

      if (success) {
        console.log('Assignment successful to suggested pallet:', scannedData.suggestedPallet.palletCode);
        
        const message = `Package ${scannedData.package.tracking} assigned to ${scannedData.suggestedPallet.palletCode}`;
        
        if (autoNext) {
          Alert.alert(
            'Package Assigned',
            message,
            [{ text: 'Continue', onPress: resetScan }]
          );
          return;
        }
        
        Alert.alert(
          'Package Assigned Successfully',
          message,
          [{ text: 'Continue Scanning', onPress: resetScan }]
        );
      } else {
        console.error('Assignment returned false');
        Alert.alert(
          'Assignment Failed', 
          'Could not assign package to the suggested pallet. Please try manual assignment or contact support.',
          [
            { text: 'Try Manual Assignment', onPress: () => setShowManualAssignment(true) },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
      }
    } catch (error) {
      console.error('Assignment error:', error);
      Alert.alert(
        'Assignment Error', 
        `Failed to assign package: ${error instanceof Error ? error.message : 'Unknown error'}`,
        [
          { text: 'Try Manual Assignment', onPress: () => setShowManualAssignment(true) },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    }
  };

  const handlePrintLabel = () => {
    if (!scannedData?.suggestedPallet) return;

    const zpl = generatePalletBarcode(scannedData.suggestedPallet.palletCode);

    Alert.alert('Print Pallet Label', `ZPL code generated for ${scannedData.suggestedPallet.palletCode}\n\nIn production, this would be sent to the printer.`, [
      { text: 'OK' },
      { text: 'Copy ZPL', onPress: () => console.log('ZPL copied to clipboard:', zpl) },
    ]);
  };

  const handleConfirmPO = async () => {
    if (!parsedLabel) return;
    const cleaned = poInput.trim().toUpperCase();
    if (cleaned.length < 3) {
      Alert.alert('Invalid PO', 'Please enter at least 3 characters for the PO number.');
      return;
    }
    const updated = { ...parsedLabel, poNumber: cleaned } as ParsedLabelPayload;
    setParsedLabel(updated);
    setShowMissingPOModal(false);
    setShowPOEntry(false);
    setPoInput('');
    
    try {
      console.log('Attempting database lookup with corrected PO:', updated.tracking);
      const apiResponse = await lookupPackageInApi(updated.tracking!);
      if (apiResponse.success && apiResponse.data) {
        // Create a custom process result using real API data
        const processResult = {
          package: {
            id: `pkg-${Date.now()}`,
            tracking: updated.tracking!,
            poNumber: updated.poNumber!,
            poId: `po-${Date.now()}`,
            palletId: '',
            palletCode: '',
            state: 'SCANNED' as const,
            location: '',
            timestamp: new Date().toISOString(),
            apiMatched: true,
            contents: apiResponse.data.contents,
            weight: apiResponse.data.weight,
            dimensions: apiResponse.data.dimensions,
          },
          po: {
            id: `po-${Date.now()}`,
            poNumber: updated.poNumber!,
            dueDate: apiResponse.data.expectedDeliveryDate || new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            vendorName: apiResponse.data.vendor || 'Unknown Vendor',
            department: 'EMB',
            priority: 'NORMAL' as const,
            status: 'OPEN' as const,
          },
          suggestedPallet: {
            id: `pal-${Date.now()}`,
            palletCode: `LP101002`,
            workDate: apiResponse.data.expectedDeliveryDate || new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            dayBucket: 'TOMORROW',
            department: 'EMB',
            state: 'OPEN' as const,
            packageCount: 0,
            currentLocation: 'Z1/A01/B01/L1',
            created: true,
          },
          apiMatched: true,
        };
        setScannedData(processResult);
      } else {
        throw new Error('Package not found in database');
      }
    } catch (dbError) {
      console.log('Database lookup failed - creating unmatched package result');
      // Create result for unmatched package using actual scanned data
      const unmatchedResult = {
        package: {
          id: `pkg-${Date.now()}`,
          tracking: updated.tracking!,
          poNumber: updated.poNumber!,
          poId: `po-unmatched-${Date.now()}`,
          palletId: '',
          palletCode: '',
          state: 'SCANNED' as const,
          location: '',
          timestamp: new Date().toISOString(),
          apiMatched: false,
        },
        po: {
          id: `po-unmatched-${Date.now()}`,
          poNumber: updated.poNumber!,
          dueDate: new Date().toISOString().split('T')[0],
          vendorName: 'Unknown',
          department: 'PENDING',
          priority: 'NORMAL' as const,
          status: 'OPEN' as const,
        },
        suggestedPallet: {
          id: `unmatched-${Date.now()}`,
          palletCode: `PAL-UNMATCHED-${new Date().toISOString().split('T')[0]}`,
          workDate: new Date().toISOString().split('T')[0],
          dayBucket: 'UNMATCHED',
          department: 'PENDING',
          state: 'OPEN' as const,
          packageCount: 0,
          currentLocation: 'Z1/A01/B01/L1',
          created: true,
        },
        apiMatched: false,
        apiError: 'Package not found in database - moved to unmatched pallet',
      };
      setScannedData(unmatchedResult);
    }
  };

  const handlePOOCRResult = async (result: LabelExtractionResult) => {
    console.log('PO OCR result received:', result);
    setIsProcessing(true);
    
    try {
      const textLines = (result.ocrLines ?? []).map(l => (l?.text ?? '')).filter(Boolean);
      const ocrText = textLines.join(' ').toUpperCase();
      console.log('OCR text for PO extraction:', ocrText);

      const candidates: string[] = [];

      const patterns: RegExp[] = [
        /\bP\s*O\s*#?\s*[:\-]?\s*([A-Z0-9\-]{3,24})\b/i,
        /\bP\.\s*O\.\s*#?\s*[:\-]?\s*([A-Z0-9\-]{3,24})\b/i,
        /\bPURCHASE\s+ORDER\s*#?\s*[:\-]?\s*([A-Z0-9\-]{3,24})\b/i,
        /\bPO#\s*([A-Z0-9\-]{3,24})\b/i,
        /\bPO\s*[:\-]?\s*([A-Z0-9\-]{3,24})\b/i,
      ];

      for (const rx of patterns) {
        const m = ocrText.match(rx);
        if (m?.[1]) candidates.push(m[1].toUpperCase());
      }

      if (candidates.length === 0) {
        for (const rawLine of textLines) {
          const line = rawLine.toUpperCase();
          if (/\b(P\s*O|P\.\s*O\.|PURCHASE\s+ORDER)\b/.test(line)) {
            const tokenMatch = line.replace(/[^A-Z0-9#:\-]/g, ' ').split(/\s+/).find(t => /^(PO|P\.?O\.?|PO#|P\s*O)$/.test(t) === false && /^[A-Z0-9][A-Z0-9\-]{2,23}$/.test(t));
            if (tokenMatch) candidates.push(tokenMatch.toUpperCase());
          }
        }
      }

      const unique = Array.from(new Set(candidates)).filter(c => c.length >= 3);
      unique.sort((a, b) => b.length - a.length);
      const extractedPO = unique[0] ?? '';
      
      if (extractedPO) {
        setPoOcrResult(extractedPO);
        setPoInput(extractedPO);
        setShowPOOCR(false);
        Alert.alert(
          'PO Number Found',
          `Found PO: ${extractedPO}\n\nThe PO has been filled in automatically. You can edit it if needed.`,
          [{ text: 'OK' }]
        );
      } else {
        setShowPOOCR(false);
        Alert.alert(
          'No PO Found',
          'Could not extract a PO number from the image. Please enter it manually or try scanning again with better positioning.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('PO OCR processing error:', error);
      setShowPOOCR(false);
      Alert.alert('OCR Error', 'Failed to process the image. Please try again or enter the PO manually.');
    } finally {
      setIsProcessing(false);
    }
  };

  const getPalletDisplayInfo = (pallet: any) => {
    const isUnmatched = pallet.dayBucket === 'UNMATCHED';
    const isToday = pallet.dayBucket === 'TODAY';
    const isTomorrow = pallet.dayBucket === 'TOMORROW';
    const isWeekday = ['MON', 'TUE', 'WED', 'THU', 'FRI'].includes(pallet.dayBucket);
    const isNextWeek = pallet.dayBucket === 'NEXT-WEEK';
    
    let category = 'Standard';
    let color = '#6b7280';
    let bgColor = '#f9fafb';
    let borderColor = '#e5e7eb';
    let displayName = pallet.palletCode;
    
    if (isUnmatched) {
      category = 'Unmatched';
      color = '#dc2626';
      bgColor = '#fef2f2';
      borderColor = '#fecaca';
      displayName = `UNMATCHED-${pallet.palletCode.split('-').pop()}`;
    } else if (isToday) {
      category = 'Today';
      color = '#dc2626';
      bgColor = '#fef2f2';
      borderColor = '#fecaca';
      displayName = `TODAY • ${pallet.department}`;
    } else if (isTomorrow) {
      category = 'Tomorrow';
      color = '#ea580c';
      bgColor = '#fff7ed';
      borderColor = '#fed7aa';
      displayName = `TOMORROW • ${pallet.department}`;
    } else if (isWeekday) {
      category = 'This Week';
      color = '#0891b2';
      bgColor = '#f0f9ff';
      borderColor = '#bae6fd';
      displayName = `${pallet.dayBucket} • ${pallet.department}`;
    } else if (isNextWeek) {
      category = 'Next Week';
      color = '#059669';
      bgColor = '#f0fdf4';
      borderColor = '#bbf7d0';
      displayName = `NEXT WEEK • ${pallet.department}`;
    } else {
      displayName = `${pallet.dayBucket} • ${pallet.department}`;
    }
    
    return {
      category,
      color,
      bgColor,
      borderColor,
      displayName,
      priority: isUnmatched ? 0 : isToday ? 1 : isTomorrow ? 2 : isWeekday ? 3 : 4
    };
  };

  const filteredPallets = useMemo(() => {
    const q = palletSearch.trim().toUpperCase();
    let filtered = pallets.filter((p) => p.state === 'OPEN');
    
    if (q) {
      filtered = filtered.filter(
        (p) => p.palletCode.toUpperCase().includes(q) || p.department.toUpperCase().includes(q) || p.dayBucket.toUpperCase().includes(q)
      );
    }
    
    return filtered.sort((a, b) => {
      const aInfo = getPalletDisplayInfo(a);
      const bInfo = getPalletDisplayInfo(b);
      
      if (aInfo.priority !== bInfo.priority) {
        return aInfo.priority - bInfo.priority;
      }
      
      return a.department.localeCompare(b.department);
    });
  }, [pallets, palletSearch]);

  const groupedPallets = useMemo(() => {
    const groups: { [key: string]: any[] } = {};
    
    filteredPallets.forEach(pallet => {
      const info = getPalletDisplayInfo(pallet);
      if (!groups[info.category]) {
        groups[info.category] = [];
      }
      groups[info.category].push({ ...pallet, displayInfo: info });
    });
    
    return groups;
  }, [filteredPallets]);

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <Text>Requesting camera permission...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No access to camera</Text>
        <TouchableOpacity style={styles.button} onPress={requestCameraPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {!scannedData && !frozenImage ? (
        <>
          {scanMode === 'label' ? (
            <>
              <EnhancedBarcodeScanner onScan={() => {}} onLabelExtracted={handleLabelExtracted} mode="label" />
              <View style={styles.modeSwitcher}>
                <TouchableOpacity
                  style={[styles.modeChip, styles.modeChipInactive]}
                  onPress={() => setScanMode('barcode')}
                  testID="chip-barcode"
                >
                  <Text style={styles.modeChipText}>Barcode Only</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeChip, styles.modeChipActive]}
                  onPress={() => setScanMode('label')}
                  testID="chip-label"
                >
                  <Text style={[styles.modeChipText, styles.modeChipTextActive]}>Label + OCR</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : deviceMode === 'mobile-camera' ? (
            <>
              <EnhancedBarcodeScanner onScan={handleBarcodeOnlyScan} mode="barcode" />
              <View style={styles.modeSwitcher}>
                <TouchableOpacity
                  style={[styles.modeChip, styles.modeChipActive]}
                  onPress={() => setScanMode('barcode')}
                  testID="chip-barcode"
                >
                  <Text style={[styles.modeChipText, styles.modeChipTextActive]}>Barcode Only</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modeChip, styles.modeChipInactive]}
                  onPress={() => setScanMode('label')}
                  testID="chip-label"
                >
                  <Text style={styles.modeChipText}>Label + OCR</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.barcodeOnlyHint}>
                <Text style={styles.barcodeOnlyTitle}>Barcode-only mode</Text>
                <Text style={styles.barcodeOnlyText}>Align the barcode with the red line. You&apos;ll enter PO manually after scan.</Text>
              </View>
            </>
          ) : (
            <View style={styles.wedgeContainer}>
              <Text style={styles.wedgeHeader}>{deviceMode === 'skorpio-x5' ? 'Skorpio X5 Hardware Scanner' : 'External Wedge'} Mode</Text>
              <Text style={styles.wedgeSub}>The input field below is focused. Use your hardware scanner to scan a barcode.</Text>
              <TextInput
                style={styles.wedgeInput}
                autoFocus
                blurOnSubmit={false}
                onChangeText={(text) => {
                  // Auto-submit when a complete barcode is detected
                  const cleaned = text.trim().toUpperCase();
                  // Check for common barcode patterns that indicate a complete scan
                  if (
                    /^1Z[A-Z0-9]{16}$/i.test(cleaned) || // UPS
                    /^\d{12,22}$/.test(cleaned) || // FedEx
                    cleaned.length >= 10 // Generic minimum length
                  ) {
                    console.log('Auto-detected complete barcode:', cleaned);
                    handleBarcodeOnlyScan(cleaned);
                  }
                }}
                onSubmitEditing={({ nativeEvent }) => {
                  const val = nativeEvent?.text?.trim().toUpperCase() ?? '';
                  if (val) {
                    console.log('Manual submit barcode:', val);
                    handleBarcodeOnlyScan(val);
                  }
                }}
                testID="wedge-input"
                placeholder="Ready to scan - Point scanner at barcode"
                placeholderTextColor="#9ca3af"
                autoCapitalize="characters"
                autoCorrect={false}
                selectTextOnFocus={true}
                clearButtonMode="while-editing"
              />
              <View style={styles.wedgeStatus}>
                <View style={[styles.statusDot, styles.statusDotActive]} />
                <Text style={styles.wedgeStatusText}>Scanner Ready</Text>
              </View>
            </View>
          )}

          <View style={styles.overlay}>
            <View style={[styles.scanFrame, { width: frameWidth, height: frameHeight }]} testID="scan-frame-4x6">
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>

            {scanMode === 'label' && (
            <View style={styles.instructions}>
              <Camera color="#fff" size={32} />
              <Text style={styles.instructionText}>Position shipping label within frame</Text>
              <Text style={styles.instructionSubtext}>Tap &quot;Capture Label&quot; to scan and process</Text>
            </View>
            )}
          </View>
        </>
      ) : frozenImage && isProcessing ? (
        <View style={styles.processingContainer}>
          <View style={styles.frozenImageContainer}>
            <Text style={styles.processingTitle}>Processing Label...</Text>
            <View style={styles.processingIndicator}>
              <Zap color="#10b981" size={24} />
              <Text style={styles.processingText}>Extracting data from label</Text>
            </View>
          </View>
        </View>
      ) : frozenImage && scanResult ? (
        <View style={styles.resultOverlay}>
          <View style={styles.resultContainer}>
            <View style={[styles.resultIcon, scanResult === 'good' ? styles.goodScan : styles.badScan]}>
              {scanResult === 'good' ? <CheckCircle color="#10b981" size={48} /> : <X color="#ef4444" size={48} />}
            </View>

            <Text style={[styles.resultTitle, scanResult === 'good' ? styles.goodScanText : styles.badScanText]}>
              {scanResult === 'good' ? 'Good Scan' : 'Scan Issue'}
            </Text>

            {parsedLabel && (
              <View style={styles.extractedData}>
                <Text style={styles.dataTitle}>Extracted Data:</Text>
                {parsedLabel.tracking && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.dataItem}>Tracking: {parsedLabel.tracking}</Text>
                    <TouchableOpacity
                      onPress={async () => {
                        try {
                          await Clipboard.setStringAsync(parsedLabel.tracking ?? '');
                          console.log('Copied parsed tracking to clipboard');
                        } catch (e) {
                          console.log('Clipboard copy failed', e);
                        }
                      }}
                      testID="copy-parsed-tracking"
                      style={{ padding: 4 }}
                    >
                      <Copy color="#9ca3af" size={14} />
                    </TouchableOpacity>
                  </View>
                )}
                {parsedLabel.poNumber && <Text style={styles.dataItem}>PO: {parsedLabel.poNumber}</Text>}
                {parsedLabel.reference && <Text style={styles.dataItem}>Reference: {parsedLabel.reference}</Text>}
                <Text style={styles.dataItem}>Carrier: {parsedLabel.carrier}</Text>
                <Text style={styles.dataItem}>Confidence: {Math.round(parsedLabel.confidence * 100)}%</Text>
                <TouchableOpacity style={[styles.continueButton, { backgroundColor: '#1f2937', marginTop: 12 }]} onPress={() => setShowEditDetails(true)} testID="edit-details-button">
                  <Edit3 color="#fff" size={18} />
                  <Text style={styles.continueButtonText}>Edit Details</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity style={styles.continueButton} onPress={resetScan}>
              <Text style={styles.continueButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <ScrollView style={styles.resultContainer}>
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Package color="#10b981" size={32} />
              <Text style={styles.resultTitle}>Package Scanned</Text>
            </View>

            <View style={[styles.statusBanner, scannedData.apiMatched ? styles.statusSuccess : styles.statusWarning]}>
              {scannedData.apiMatched ? <CheckCircle color="#10b981" size={20} /> : <AlertTriangle color="#f59e0b" size={20} />}
              <Text style={[styles.statusText, scannedData.apiMatched ? styles.statusTextSuccess : styles.statusTextWarning]}>
                {scannedData.apiMatched ? 'Package found in system' : 'Package not found - moved to unmatched pallet'}
              </Text>
            </View>

            <View style={styles.resultDetails}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Tracking:</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.detailValue}>{scannedData.package.tracking}</Text>
                  <TouchableOpacity
                    onPress={async () => {
                      try {
                        await Clipboard.setStringAsync(scannedData.package.tracking ?? '');
                        console.log('Copied tracking to clipboard');
                      } catch (e) {
                        console.log('Clipboard copy failed', e);
                      }
                    }}
                    testID="copy-tracking"
                    style={{ padding: 4 }}
                  >
                    <Copy color="#6b7280" size={16} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>PO Number:</Text>
                <Text style={styles.detailValue}>{scannedData.po.poNumber}</Text>
              </View>

              {scannedData.apiMatched && (
                <>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Contents:</Text>
                    <Text style={styles.detailValue}>{scannedData.package.contents || 'N/A'}</Text>
                  </View>

                  {scannedData.package.weight && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Weight:</Text>
                      <Text style={styles.detailValue}>{scannedData.package.weight} lbs</Text>
                    </View>
                  )}

                  {scannedData.package.dimensions && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Dimensions:</Text>
                      <Text style={styles.detailValue}>
                        {scannedData.package.dimensions.length}&quot; × {scannedData.package.dimensions.width}&quot; × {scannedData.package.dimensions.height}&quot;
                      </Text>
                    </View>
                  )}
                </>
              )}

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Due Date:</Text>
                <Text style={styles.detailValue}>{scannedData.po.dueDate}</Text>
              </View>

              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Department:</Text>
                <Text style={styles.detailValue}>{scannedData.po.department}</Text>
              </View>

              {scannedData.po.vendorName && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Vendor:</Text>
                  <Text style={styles.detailValue}>{scannedData.po.vendorName}</Text>
                </View>
              )}
            </View>

            {!scannedData.apiMatched && scannedData.apiError && (
              <View style={styles.errorInfo}>
                <Info color="#6b7280" size={16} />
                <Text style={styles.errorText}>{scannedData.apiError}</Text>
              </View>
            )}

            <View style={styles.palletSuggestion}>
              <Text style={styles.suggestionTitle}>{scannedData.apiMatched ? 'Suggested Pallet' : 'Unmatched Pallet'}</Text>
              <View style={[styles.palletCard, !scannedData.apiMatched && styles.unmatchedPalletCard]}>
                <Text style={[styles.palletCode, !scannedData.apiMatched && styles.unmatchedPalletCode]}>{scannedData.suggestedPallet.palletCode}</Text>
                <Text style={styles.palletInfo}>{scannedData.suggestedPallet.dayBucket} • {scannedData.suggestedPallet.department}</Text>
                {scannedData.suggestedPallet.created && (
                  <View style={[styles.newBadge, !scannedData.apiMatched && styles.unmatchedNewBadge]}>
                    <Text style={styles.newBadgeText}>NEW PALLET</Text>
                  </View>
                )}
                {!scannedData.apiMatched && (
                  <View style={styles.unmatchedBadge}>
                    <Text style={styles.unmatchedBadgeText}>NEEDS REVIEW</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity style={[styles.actionButton, styles.primaryButton]} onPress={() => handleAssignPallet(false)} testID="assign-pallet">
                <Check color="#fff" size={20} />
                <Text style={styles.primaryButtonText}>Assign to Pallet</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.actionButton, styles.primaryButton, { backgroundColor: '#059669' }]} onPress={() => handleAssignPallet(true)} testID="assign-and-next">
                <Check color="#fff" size={20} />
                <Text style={styles.primaryButtonText}>Assign & Next</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.actionButton, styles.secondaryButton]} onPress={() => setShowManualAssignment(true)} testID="manual-assign">
                <Package color="#1e40af" size={20} />
                <Text style={styles.secondaryButtonText}>Choose Different Pallet</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.actionButton, styles.secondaryButton]} onPress={handlePrintLabel}>
                <Printer color="#1e40af" size={20} />
                <Text style={styles.secondaryButtonText}>Print Label</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.actionButton, styles.tertiaryButton]} onPress={resetScan}>
                <X color="#6b7280" size={20} />
                <Text style={styles.tertiaryButtonText}>Scan Another</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}

      <Modal visible={showManualAssignment} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Assign to Pallet</Text>
            <TouchableOpacity onPress={() => setShowManualAssignment(false)}>
              <X color="#6b7280" size={24} />
            </TouchableOpacity>
          </View>

          <Text style={styles.modalSubtitle}>Select an open pallet or create a new one.</Text>

          {parsedLabel && (
            <View style={styles.packageInfo}>
              <Text style={styles.packageInfoTitle}>Scanned Package</Text>
              <Text style={styles.packageInfoText}>Tracking: {parsedLabel.tracking || 'Unknown'}</Text>
              <Text style={styles.packageInfoText}>PO: {parsedLabel.poNumber || 'Unknown'}</Text>
            </View>
          )}

          <View style={styles.searchRow}>
            <SearchIcon color="#6b7280" size={18} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search pallets by code, department, or bucket"
              placeholderTextColor="#9ca3af"
              value={palletSearch}
              onChangeText={setPalletSearch}
              autoCapitalize="characters"
              testID="pallet-search-input"
            />
          </View>

          <ScrollView style={styles.palletList}>
            {Object.keys(groupedPallets).length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No open pallets match your search</Text>
              </View>
            ) : (
              Object.entries(groupedPallets).map(([category, pallets]) => (
                <View key={category} style={styles.palletGroup}>
                  <Text style={styles.palletGroupTitle}>{category}</Text>
                  {pallets.map((pallet) => (
                    <TouchableOpacity 
                      key={pallet.id} 
                      style={[
                        styles.palletOption, 
                        styles.palletOptionTouchable,
                        {
                          backgroundColor: pallet.displayInfo.bgColor,
                          borderColor: pallet.displayInfo.borderColor,
                        }
                      ]} 
                      onPress={() => {
                        console.log('=== PALLET SELECTION ===');
                        console.log('Pallet selected:', {
                          id: pallet.id,
                          code: pallet.palletCode,
                          department: pallet.department,
                          dayBucket: pallet.dayBucket
                        });
                        console.log('Parsed label:', parsedLabel);
                        handleManualPalletAssignment(pallet.id);
                      }} 
                      testID={`pallet-option-${pallet.id}`}
                      activeOpacity={0.7}
                      disabled={false}
                    >
                      <View style={styles.palletOptionContent}>
                        <Text style={[
                          styles.palletOptionCode,
                          { color: pallet.displayInfo.color }
                        ]}>
                          {pallet.displayInfo.displayName}
                        </Text>
                        <Text style={styles.palletOptionInfo}>
                          {pallet.packageCount} packages • {pallet.workDate}
                        </Text>
                      </View>
                      <View style={[
                        styles.palletSelectIcon,
                        { backgroundColor: pallet.displayInfo.color + '20' }
                      ]}>
                        <Package color={pallet.displayInfo.color} size={20} />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ))
            )}
          </ScrollView>

          <TouchableOpacity
            style={styles.createPalletButton}
            onPress={async () => {
              const today = new Date().toISOString().split('T')[0];
              const newPallet = await createPallet(today, 'MANUAL', 'WAREHOUSE');
              setPalletSearch('');
              Alert.alert('Pallet Created', `Created ${newPallet.palletCode}`);
            }}
            testID="create-pallet-button"
          >
            <Plus color="#fff" size={20} />
            <Text style={styles.createPalletButtonText}>Create New Pallet</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <Modal visible={showEditDetails} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Confirm Details</Text>
            <TouchableOpacity onPress={() => setShowEditDetails(false)}>
              <X color="#6b7280" size={24} />
            </TouchableOpacity>
          </View>

          <Text style={styles.modalSubtitle}>Fix carrier or tracking if misread before lookup.</Text>

          <View style={styles.packageInfo}>
            <Text style={styles.packageInfoTitle}>Tracking Number</Text>
            <View style={styles.poInputBox}>
              <TextInput
                style={styles.poInput}
                placeholder="1Z... or 12-22 digits"
                placeholderTextColor="#9ca3af"
                value={trackingInput}
                onChangeText={setTrackingInput}
                autoCapitalize="characters"
                testID="tracking-input"
              />
            </View>
          </View>

          <Text style={styles.packageInfoTitle}>Carrier</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            {(['UPS','FEDEX','UNKNOWN'] as const).map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setCarrierInput(c)}
                style={[styles.carrierChip, carrierInput === c ? styles.carrierChipActive : undefined]}
                testID={`carrier-chip-${c}`}
              >
                <Text style={[styles.carrierChipText, carrierInput === c ? styles.carrierChipTextActive : undefined]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity style={styles.poSecondary} onPress={() => { setShowEditDetails(false); }} testID="edit-cancel">
              <X color="#6b7280" size={18} />
              <Text style={styles.poSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.poPrimary}
              onPress={async () => {
                const cleanedTracking = trackingInput.trim().toUpperCase();
                if (!cleanedTracking) {
                  Alert.alert('Missing tracking', 'Please enter a tracking number.');
                  return;
                }
                const isUPS = carrierInput === 'UPS' && /^1Z[A-Z0-9]{16}$/.test(cleanedTracking);
                const isFedEx = carrierInput === 'FEDEX' && /^\d{12,22}$/.test(cleanedTracking);
                const isUnknown = carrierInput === 'UNKNOWN' && cleanedTracking.length >= 8;
                if (!(isUPS || isFedEx || isUnknown)) {
                  Alert.alert('Invalid tracking', 'Tracking does not match selected carrier pattern.');
                  return;
                }
                if (!parsedLabel) return;
                const updatedLabel: ParsedLabelPayload = { ...parsedLabel, tracking: cleanedTracking, carrier: carrierInput };
                setParsedLabel(updatedLabel);
                setShowEditDetails(false);
                try {
                  console.log('DB lookup after confirm for:', updatedLabel.tracking);
                  const apiResponse = await lookupPackageInApi(updatedLabel.tracking!);
                  if (apiResponse.success && apiResponse.data) {
                    // Create result using real API data
                    const processResult = {
                      package: {
                        id: `pkg-${Date.now()}`,
                        tracking: updatedLabel.tracking!,
                        poNumber: updatedLabel.poNumber || 'UNKNOWN',
                        poId: `po-${Date.now()}`,
                        palletId: '',
                        palletCode: '',
                        state: 'SCANNED' as const,
                        location: '',
                        timestamp: new Date().toISOString(),
                        apiMatched: true,
                        contents: apiResponse.data.contents,
                        weight: apiResponse.data.weight,
                        dimensions: apiResponse.data.dimensions,
                      },
                      po: {
                        id: `po-${Date.now()}`,
                        poNumber: updatedLabel.poNumber || apiResponse.data.poNumber,
                        dueDate: apiResponse.data.expectedDeliveryDate || new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                        vendorName: apiResponse.data.vendor || 'Unknown Vendor',
                        department: 'EMB',
                        priority: 'NORMAL' as const,
                        status: 'OPEN' as const,
                      },
                      suggestedPallet: {
                        id: `pal-${Date.now()}`,
                        palletCode: `LP101002`,
                        workDate: apiResponse.data.expectedDeliveryDate || new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                        dayBucket: 'TOMORROW',
                        department: 'EMB',
                        state: 'OPEN' as const,
                        packageCount: 0,
                        currentLocation: 'Z1/A01/B01/L1',
                        created: true,
                      },
                      apiMatched: true,
                    };
                    setScannedData(processResult);
                  } else {
                    throw new Error('Package not found in database');
                  }
                } catch (e) {
                  console.log('Database lookup failed - creating unmatched package result');
                  // Create result for unmatched package using actual scanned data
                  const unmatchedResult = {
                    package: {
                      id: `pkg-${Date.now()}`,
                      tracking: updatedLabel.tracking!,
                      poNumber: updatedLabel.poNumber || 'UNKNOWN',
                      poId: `po-unmatched-${Date.now()}`,
                      palletId: '',
                      palletCode: '',
                      state: 'SCANNED' as const,
                      location: '',
                      timestamp: new Date().toISOString(),
                      apiMatched: false,
                    },
                    po: {
                      id: `po-unmatched-${Date.now()}`,
                      poNumber: updatedLabel.poNumber || 'UNKNOWN',
                      dueDate: new Date().toISOString().split('T')[0],
                      vendorName: 'Unknown',
                      department: 'PENDING',
                      priority: 'NORMAL' as const,
                      status: 'OPEN' as const,
                    },
                    suggestedPallet: {
                      id: `unmatched-${Date.now()}`,
                      palletCode: `LP101001`,
                      workDate: new Date().toISOString().split('T')[0],
                      dayBucket: 'UNMATCHED',
                      department: 'PENDING',
                      state: 'OPEN' as const,
                      packageCount: 0,
                      currentLocation: 'Z1/A01/B01/L1',
                      created: true,
                    },
                    apiMatched: false,
                    apiError: 'Package not found in database - moved to unmatched pallet',
                  };
                  setScannedData(unmatchedResult);
                }
              }}
              testID="edit-confirm"
            >
              <Check color="#fff" size={18} />
              <Text style={styles.poPrimaryText}>Looks Good</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showPOEntry} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Enter PO Number</Text>
            <TouchableOpacity onPress={() => setShowPOEntry(false)}>
              <X color="#6b7280" size={24} />
            </TouchableOpacity>
          </View>

          <Text style={styles.modalSubtitle}>Barcode scanned successfully! Now enter the PO number or use OCR to capture it.</Text>

          {parsedLabel && (
            <View style={styles.packageInfo}>
              <Text style={styles.packageInfoTitle}>Scanned Tracking</Text>
              <Text style={styles.packageInfoText}>Tracking: {parsedLabel.tracking}</Text>
              <Text style={styles.packageInfoText}>Carrier: {parsedLabel.carrier}</Text>
            </View>
          )}

          <Text style={styles.packageInfoTitle}>PO Number</Text>
          <View style={styles.poInputBox}>
            <TextInput
              style={styles.poInput}
              placeholder="Enter PO number (e.g., PO123456)"
              placeholderTextColor="#9ca3af"
              value={poInput}
              onChangeText={setPoInput}
              autoCapitalize="characters"
              testID="barcode-po-input"
            />
          </View>

          <TouchableOpacity
            style={styles.ocrButton}
            onPress={() => {
              console.log('Opening PO OCR scanner');
              setShowPOOCR(true);
            }}
            testID="open-po-ocr"
          >
            <Camera color="#1e40af" size={20} />
            <Text style={styles.ocrButtonText}>Use OCR to Capture PO</Text>
          </TouchableOpacity>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
            <TouchableOpacity 
              style={styles.poSecondary} 
              onPress={() => {
                setShowPOEntry(false);
                resetScan();
              }} 
              testID="po-entry-cancel"
            >
              <X color="#6b7280" size={18} />
              <Text style={styles.poSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.poPrimary}
              onPress={handleConfirmPO}
              testID="po-entry-confirm"
            >
              <Check color="#fff" size={18} />
              <Text style={styles.poPrimaryText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showPOOCR} animationType="slide" presentationStyle="fullScreen">
        <View style={styles.container}>
          <EnhancedBarcodeScanner 
            onScan={() => {}} 
            onLabelExtracted={handlePOOCRResult} 
            mode="label" 
          />
          
          <View style={styles.poOcrOverlay}>
            <View style={styles.poOcrHeader}>
              <TouchableOpacity 
                style={styles.poOcrCloseButton}
                onPress={() => {
                  console.log('Closing PO OCR scanner');
                  setShowPOOCR(false);
                }}
                testID="close-po-ocr"
              >
                <X color="#fff" size={24} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.poOcrInstructions}>
              <Text style={styles.poOcrTitle}>Scan PO Number</Text>
              <Text style={styles.poOcrText}>Position the shipping label so the PO number area is clearly visible within the frame, then tap &quot;Capture Label&quot; to extract the PO number automatically.</Text>
              {poOcrResult && (
                <View style={styles.poOcrResult}>
                  <Text style={styles.poOcrResultText}>Last found: {poOcrResult}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showMissingPOModal} animationType="fade" transparent>
        <View style={styles.poOverlay}>
          <View style={styles.poModal}>
            <Text style={styles.poTitle}>PO Number Missing</Text>
            <Text style={styles.poSubtitle}>Please enter the PO number from the shipping label or scan again with better positioning.</Text>
            <View style={styles.poInputBox}>
              <TextInput
                style={styles.poInput}
                placeholder="PO123456"
                placeholderTextColor="#9ca3af"
                value={poInput}
                onChangeText={setPoInput}
                autoCapitalize="characters"
                testID="po-input"
              />
            </View>
            <View style={styles.poActions}>
              <TouchableOpacity style={styles.poSecondary} onPress={() => { setShowMissingPOModal(false); setPoInput(''); resetScan(); }} testID="po-rescan">
                <X color="#6b7280" size={18} />
                <Text style={styles.poSecondaryText}>Scan Again</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.poPrimary} onPress={handleConfirmPO} testID="po-confirm">
                <Check color="#fff" size={18} />
                <Text style={styles.poPrimaryText}>Continue</Text>
              </TouchableOpacity>
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
    backgroundColor: '#000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#10b981',
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
  wedgeContainer: {
    padding: 16,
  },
  wedgeHeader: {
    color: '#ecfeff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  wedgeSub: {
    color: '#93c5fd',
    fontSize: 12,
    marginBottom: 10,
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
  instructions: {
    position: 'absolute',
    bottom: 24,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  instructionText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  instructionSubtext: {
    color: '#9ca3af',
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  barcodeOnlyHint: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  barcodeOnlyTitle: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '700',
  },
  barcodeOnlyText: {
    color: '#e5e7eb',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  modeSwitcher: {
    position: 'absolute',
    top: 20,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    zIndex: 20,
  },
  modeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9999,
    borderWidth: 1,
  },
  modeChipActive: {
    borderColor: '#10b981',
    backgroundColor: '#064e3b',
  },
  modeChipInactive: {
    borderColor: '#9ca3af',
    backgroundColor: 'rgba(17,24,39,0.7)',
  },
  modeChipText: {
    color: '#d1d5db',
    fontSize: 12,
    fontWeight: '700',
  },
  modeChipTextActive: {
    color: '#ecfdf5',
  },
  resultContainer: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  resultCard: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    padding: 20,
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
  resultHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginTop: 8,
  },
  resultDetails: {
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  palletSuggestion: {
    marginBottom: 24,
  },
  suggestionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  palletCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 2,
    borderColor: '#93c5fd',
  },
  palletCode: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 4,
  },
  palletInfo: {
    fontSize: 14,
    color: '#6b7280',
  },
  newBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  actions: {
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: '#10b981',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#93c5fd',
  },
  secondaryButtonText: {
    color: '#1e40af',
    fontSize: 16,
    fontWeight: '600',
  },
  tertiaryButton: {
    backgroundColor: '#f3f4f6',
  },
  tertiaryButtonText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#1e40af',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  statusSuccess: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  statusWarning: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  statusTextSuccess: {
    color: '#15803d',
  },
  statusTextWarning: {
    color: '#d97706',
  },
  errorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  unmatchedPalletCard: {
    backgroundColor: '#fef3c7',
    borderColor: '#fbbf24',
  },
  unmatchedPalletCode: {
    color: '#d97706',
  },
  unmatchedNewBadge: {
    backgroundColor: '#f59e0b',
  },
  unmatchedBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  unmatchedBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  processingContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  frozenImageContainer: {
    alignItems: 'center',
    padding: 32,
  },
  processingTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 24,
  },
  processingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  processingText: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: '500',
  },
  resultOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  resultIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  goodScan: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 2,
    borderColor: '#10b981',
  },
  badScan: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 2,
    borderColor: '#ef4444',
  },
  goodScanText: {
    color: '#10b981',
  },
  badScanText: {
    color: '#ef4444',
  },
  extractedData: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    width: '100%',
  },
  dataTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  dataItem: {
    color: '#9ca3af',
    fontSize: 14,
    marginBottom: 4,
  },
  continueButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 20,
  },
  packageInfo: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  packageInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  packageInfoText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  palletList: {
    flex: 1,
  },
  palletGroup: {
    marginBottom: 24,
  },
  palletGroupTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    paddingHorizontal: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  palletOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    minHeight: 72,
  },
  palletOptionTouchable: {
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  palletSelectIcon: {
    padding: 8,
    borderRadius: 8,
    marginLeft: 12,
  },
  palletOptionContent: {
    flex: 1,
  },
  palletOptionCode: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  palletOptionInfo: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: '#111827',
    fontSize: 14,
  },
  createPalletButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
    marginTop: 12,
  },
  createPalletButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyStateText: {
    color: '#6b7280',
  },
  poOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  poModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 420,
    padding: 20,
  },
  poTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  poSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 6,
    marginBottom: 16,
  },
  poInputBox: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  poInput: {
    height: 44,
    color: '#111827',
    fontSize: 16,
  },
  poActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  poSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  poSecondaryText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '600',
  },
  poPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  poPrimaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  carrierChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  carrierChipActive: {
    borderColor: '#10b981',
    backgroundColor: '#ecfdf5',
  },
  carrierChipText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  carrierChipTextActive: {
    color: '#065f46',
  },
  ocrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#93c5fd',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
    marginTop: 12,
  },
  ocrButtonText: {
    color: '#1e40af',
    fontSize: 14,
    fontWeight: '600',
  },
  poOcrOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  poOcrHeader: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
  },
  poOcrCloseButton: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 12,
    borderRadius: 25,
  },
  poOcrInstructions: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  poOcrTitle: {
    color: '#10b981',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  poOcrText: {
    color: '#e5e7eb',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  poOcrResult: {
    marginTop: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#10b981',
  },
  poOcrResultText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  wedgeStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6b7280',
  },
  statusDotActive: {
    backgroundColor: '#10b981',
  },
  wedgeStatusText: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '600',
  },
});