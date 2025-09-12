import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Alert, Image, Animated } from 'react-native';
import { useScan } from '@/providers/scan-provider';
import * as FileSystem from 'expo-file-system';
import type { CameraView } from 'expo-camera';
import { DetectedBarcode, LabelExtractionResult, OcrLine, Symbology } from '@/types/warehouse';

interface EnhancedBarcodeScannerProps {
  onScan: (data: string) => void;
  onLabelExtracted?: (result: LabelExtractionResult) => void;
  mode?: 'barcode' | 'label' | 'training';
  continuous?: boolean;
}

export function EnhancedBarcodeScanner({ 
  onScan, 
  onLabelExtracted,
  mode = 'barcode',
  continuous = false 
}: EnhancedBarcodeScannerProps) {
  const { flags } = useScan();
  const permission: any = flags.scan.device_mode === 'mobile-camera' ? { granted: true } : { granted: false };
  const requestPermission = async () => {};
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [freezeUri, setFreezeUri] = useState<string | null>(null);
  const [showTapToOcr, setShowTapToOcr] = useState(false);
  const [tapPosition, setTapPosition] = useState<{ x: number; y: number } | null>(null);
  const cameraReadyAtRef = useRef<number>(0);
  const cameraRef = useRef<CameraView>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const scannedBarcodes = useRef<DetectedBarcode[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate the scanning line
    const animateScanLine = () => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };
    
    if (mode === 'barcode' || mode === 'label') {
      animateScanLine();
    }
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [mode, scanLineAnim]);



  const performOCR = useCallback(async (imageUri: string, focusArea?: { x: number; y: number }, retryCount = 0): Promise<string> => {
    const startTime = Date.now();
    console.log(`Starting OCR attempt ${retryCount + 1} at:`, startTime);
    
    try {
      // Increased timeout to 8 seconds for more reliable processing
      const timeoutPromise = new Promise<string>((_, reject) => {
        setTimeout(() => reject(new Error('OCR timeout after 8 seconds')), 8000);
      });
      
      const ocrPromise = async (): Promise<string> => {
        let base64: string = '';
        
        // Skip preprocessing for speed - use original image
        if (Platform.OS === 'web') {
          const response = await fetch(imageUri);
          const blob = await response.blob();
          const reader = new FileReader();
          base64 = await new Promise<string>((resolve) => {
            reader.onloadend = () => {
              const result = reader.result as string;
              resolve(result.split(',')[1] || '');
            };
            reader.readAsDataURL(blob);
          });
        } else {
          try {
            base64 = await FileSystem.readAsStringAsync(imageUri, { 
              encoding: FileSystem.EncodingType.Base64 
            });
          } catch {
            const res = await fetch(imageUri);
            const b = await res.blob();
            const fr = new FileReader();
            base64 = await new Promise<string>((resolve) => {
              fr.onloadend = () => resolve(String(fr.result).split(',')[1] ?? '');
              fr.readAsDataURL(b);
            });
          }
        }
        
        // Optimized OCR prompt for better accuracy and speed
        const ocrPrompt = focusArea 
          ? `Extract all visible text from this shipping label image, focusing on the area near coordinates (${focusArea.x}, ${focusArea.y}). Look for: tracking numbers (like 1Z followed by 16 characters, or 12-22 digit numbers), PO numbers, and any other text. Return all found text line by line.`
          : 'Extract all visible text from this shipping label image. Look for tracking numbers, PO numbers, addresses, and any other readable text. Return all found text line by line.';
        
        const ocrResponse = await fetch('https://toolkit.rork.com/text/llm/', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: ocrPrompt },
                  { type: 'image', image: base64 },
                ],
              },
            ],
          }),
        });
        
        if (!ocrResponse.ok) {
          const errorText = await ocrResponse.text().catch(() => 'Unknown error');
          throw new Error(`OCR API error: ${ocrResponse.status} - ${errorText}`);
        }
        
        const result = await ocrResponse.json();
        const completion = result?.completion || '';
        console.log('OCR API response:', completion);
        return String(completion);
      };
      
      const ocrResult = await Promise.race([ocrPromise(), timeoutPromise]);
      const endTime = Date.now();
      console.log(`Fast OCR completed in ${endTime - startTime}ms`);
      
      return ocrResult;
      
    } catch (error: any) {
      const endTime = Date.now();
      const errorMessage = error?.message || String(error);
      console.error(`OCR attempt ${retryCount + 1} failed after ${endTime - startTime}ms:`, errorMessage);
      
      // Retry logic for network errors or timeouts
      if (retryCount < 2 && (errorMessage.includes('timeout') || errorMessage.includes('API error') || errorMessage.includes('fetch'))) {
        console.log(`Retrying OCR (attempt ${retryCount + 2}/3) after ${Math.min(1000 * (retryCount + 1), 2000)}ms delay...`);
        await new Promise(resolve => setTimeout(resolve, Math.min(1000 * (retryCount + 1), 2000)));
        return performOCR(imageUri, focusArea, retryCount + 1);
      }
      
      // Show user-friendly error message
      if (errorMessage.includes('timeout')) {
        console.warn('OCR timed out after retries - this may be due to network issues or server load');
      } else if (errorMessage.includes('API error')) {
        console.warn('OCR API error after retries - the service may be temporarily unavailable');
      }
      
      return '';
    }
  }, []);
  
  const performTapOCR = useCallback(async (tapX: number, tapY: number) => {
    if (!freezeUri) return;
    
    console.log('Performing tap-to-OCR at position:', { x: tapX, y: tapY });
    setIsProcessing(true);
    setTapPosition({ x: tapX, y: tapY });
    
    try {
      const ocrText = await performOCR(freezeUri, { x: tapX, y: tapY }, 0);
      
      if (ocrText) {
        const lines = ocrText
          .split(/\r?\n/)
          .map((text) => text.trim())
          .filter((t) => t.length > 0);
        
        const ocrLines: OcrLine[] = lines.map((text) => ({ text }));
        
        const result: LabelExtractionResult = {
          imageUri: freezeUri,
          rawBarcodes: [...scannedBarcodes.current],
          ocrLines,
        };
        
        console.log('Tap-to-OCR result:', result);
        onLabelExtracted?.(result);
        
        Alert.alert(
          'OCR Re-scan Complete',
          `Found ${ocrLines.length} text lines. Check if PO number was detected.`,
          [{ text: 'OK', onPress: () => setShowTapToOcr(false) }]
        );
      } else {
        Alert.alert('OCR Failed', 'Could not extract text from the tapped area. Try tapping on a clearer text region.');
      }
    } catch (error) {
      console.error('Tap-to-OCR failed:', error);
      Alert.alert('OCR Error', 'Failed to process the tapped area. Please try again.');
    } finally {
      setIsProcessing(false);
      setTapPosition(null);
    }
  }, [freezeUri, performOCR, onLabelExtracted]);

  const extractLabelData = useCallback(async (imageUri: string): Promise<LabelExtractionResult> => {
    const startTime = Date.now();
    console.log('Starting fast label extraction for:', imageUri);
    
    try {
      // Run OCR with retry capability
      const ocrText = await performOCR(imageUri, undefined, 0);
      
      const cleaned = ocrText && typeof ocrText === 'string' ? ocrText : '';
      const lines = cleaned
        .split(/\r?\n/)
        .map((text) => text.trim())
        .filter((t) => t.length > 0);
      
      const ocrLines: OcrLine[] = lines.length > 0 ? lines.map((text) => ({ text })) : [];
      
      const result: LabelExtractionResult = {
        imageUri,
        rawBarcodes: [...scannedBarcodes.current],
        ocrLines,
      };
      
      const endTime = Date.now();
      console.log(`Fast label extraction completed in ${endTime - startTime}ms`);
      
      return result;
    } catch (error) {
      const endTime = Date.now();
      console.error(`Fast label extraction failed after ${endTime - startTime}ms:`, error);
      return {
        imageUri,
        rawBarcodes: [...scannedBarcodes.current],
        ocrLines: [],
      };
    }
  }, [performOCR]);

  const takePicture = useCallback(async () => {
    if (isProcessing || !cameraRef.current || !cameraReady) {
      console.log('Skip takePicture: processing or camera not ready');
      return;
    }
    
    const overallStartTime = Date.now();
    console.log('Starting capture process at:', overallStartTime);
    
    const timeSinceReady = Date.now() - (cameraReadyAtRef.current || 0);
    if (timeSinceReady < 100) { // Further reduced to 100ms
      await new Promise((r) => setTimeout(r, 100 - timeSinceReady));
    }
    
    setIsProcessing(true);
    
    try {
      // Ultra-fast capture settings
      const tryCapture = async (): Promise<string> => {
        const photo = await cameraRef.current!.takePictureAsync({
          quality: 0.3, // Lowest quality for maximum speed
          base64: false,
          skipProcessing: true,
          exif: false, // Skip EXIF data
        });
        if (!photo?.uri) throw new Error('No image URI returned from camera');
        return photo.uri;
      };
      
      let uri: string;
      try {
        uri = await tryCapture();
      } catch (e) {
        console.warn('First capture attempt failed, retrying once...', e);
        await new Promise((r) => setTimeout(r, 50)); // Minimal retry delay
        uri = await tryCapture();
      }
      
      const captureTime = Date.now();
      console.log(`Image captured in ${captureTime - overallStartTime}ms`);
      
      setFreezeUri(uri);
      
      // Start OCR processing immediately
      const result = await extractLabelData(uri);
      
      const totalTime = Date.now() - overallStartTime;
      console.log(`Total processing time: ${totalTime}ms`);
      
      if (totalTime > 8000) {
        console.warn(`Processing took ${totalTime}ms - exceeds 8 second target`);
        Alert.alert('Processing Slow', 'Label processing took longer than expected. This may be due to network conditions or image complexity.');
      }
      
      onLabelExtracted?.(result);
      
      // Show tap-to-OCR option if processing completed
      setShowTapToOcr(true);
      
    } catch (error: any) {
      const totalTime = Date.now() - overallStartTime;
      console.error(`Capture failed after ${totalTime}ms:`, error);
      
      const errorMessage = error?.message || String(error);
      let userMessage = 'Could not capture image. Please try again.';
      
      if (errorMessage.includes('timeout')) {
        userMessage = 'OCR processing timed out. This may be due to network issues. Please try again.';
      } else if (errorMessage.includes('API error')) {
        userMessage = 'OCR service is temporarily unavailable. Please try again in a moment.';
      } else if (totalTime > 8000) {
        userMessage = 'Processing took too long. Please try again with better lighting and network connection.';
      } else if (Platform.OS === 'web') {
        userMessage = 'Could not capture image. Ensure the page is on HTTPS, camera is granted, and try again.';
      }
      
      Alert.alert('Capture Failed', userMessage);
    } finally {
      setIsProcessing(false);
      // Keep frozen frame for tap-to-OCR, don't auto-clear
      if (!showTapToOcr) {
        setTimeout(() => setFreezeUri(null), 100);
      }
    }
  }, [isProcessing, cameraReady, extractLabelData, onLabelExtracted, showTapToOcr]);

  useEffect(() => {
    const interval = intervalRef.current;
    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  if (flags.scan.device_mode !== 'mobile-camera') {
    return (
      <View style={styles.container} testID="camera-disabled">
        <Text style={styles.message}>Camera disabled in current device mode</Text>
      </View>
    );
  }

  const mapTypeToSymbology = (type: string): Symbology | undefined => {
    switch (type) {
      case 'code128': return 'CODE_128';
      case 'code39': return 'CODE_39';
      case 'qr': return 'QR';
      case 'pdf417': return 'PDF_417';
      case 'datamatrix': return 'DATAMATRIX';
      case 'ean13': return 'EAN_13';
      case 'upc_a': return 'UPC_A';
      default: return undefined;
    }
  };

  const handleBarCodeScanned = ({ data, type, bounds, cornerPoints }: any) => {
    if (isProcessing) return;
    const value = String(data).trim();
    console.log('Barcode scanned:', value, type);

    const isUPS = /^1Z[A-Z0-9]{16}$/i.test(value);
    const isFedEx = /^\d{12,22}$/.test(value);
    const isTrackingCandidate = isUPS || isFedEx;

    const sym = mapTypeToSymbology(type);
    let bbox: { x: number; y: number; w: number; h: number } | undefined;
    let yCenter: number | undefined;
    try {
      if (bounds && bounds.origin && bounds.size) {
        bbox = { x: bounds.origin.x, y: bounds.origin.y, w: bounds.size.width, h: bounds.size.height };
        yCenter = bounds.origin.y + bounds.size.height / 2;
      } else if (cornerPoints && Array.isArray(cornerPoints) && cornerPoints.length > 0) {
        const xs = cornerPoints.map((p: any) => p.x ?? 0);
        const ys = cornerPoints.map((p: any) => p.y ?? 0);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);
        bbox = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
        yCenter = minY + (maxY - minY) / 2;
      }
    } catch (e) {
      console.log('Failed to compute bbox', e);
    }

    const entry: DetectedBarcode = {
      value,
      symbology: (sym ?? 'CODE_128') as Symbology,
      bbox,
      yCenter,
    };

    if (!scannedBarcodes.current.find((b) => b.value === entry.value && b.symbology === entry.symbology)) {
      scannedBarcodes.current.push(entry);
    }

    // In barcode-only mode, only accept tracking barcodes and debounce
    if (mode === 'barcode') {
      if (!isTrackingCandidate) {
        console.log('Ignored non-tracking barcode:', value);
        return;
      }
      if (value === lastScanned) return;
      setLastScanned(value);
      onScan(value);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setLastScanned(null), 2500) as any;
      return;
    }

    // For label mode, just store the barcode for later processing
    // The actual callback will be triggered by takePicture
  };

  return (
    <View style={StyleSheet.absoluteFillObject}>
      {flags.ui.show_camera_controls && (
        <View style={StyleSheet.absoluteFillObject} testID="camera-view-placeholder" />
      )}
      
      {/* Barcode Scanning Line - visible in all modes */}
      {mode === 'barcode' && (
        <View style={styles.barcodeScanOverlay}>
          <Animated.View 
            style={[
              styles.scanLine,
              {
                transform: [{
                  translateY: scanLineAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-100, 100],
                  })
                }]
              }
            ]}
          />
          <Text style={styles.barcodeGuideText}>Align tracking barcode on the red line</Text>
        </View>
      )}
      
      {freezeUri && (isProcessing || showTapToOcr) && (
        <TouchableOpacity 
          style={StyleSheet.absoluteFillObject}
          onPress={(event) => {
            if (showTapToOcr && !isProcessing) {
              const { locationX, locationY } = event.nativeEvent;
              performTapOCR(locationX, locationY);
            }
          }}
          activeOpacity={1}
          disabled={isProcessing}
        >
          <Image source={{ uri: freezeUri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" testID="frozen-frame" />
          {showTapToOcr && !isProcessing && (
            <View style={styles.tapToOcrOverlay}>
              <Text style={styles.tapToOcrText}>Tap on PO number area to re-scan with OCR</Text>
            </View>
          )}
          {tapPosition && (
            <View style={[styles.tapIndicator, { left: tapPosition.x - 10, top: tapPosition.y - 10 }]} />
          )}
        </TouchableOpacity>
      )}
      
      {(mode === 'label' || mode === 'training') && (
        <>
          {/* 4x6 Label Rectangle Overlay */}
          <View style={styles.labelOverlay}>
            <View style={styles.labelRectangle}>
              <View style={styles.cornerTopLeft} />
              <View style={styles.cornerTopRight} />
              <View style={styles.cornerBottomLeft} />
              <View style={styles.cornerBottomRight} />
              
              {/* Barcode scanning line within label rectangle */}
              <Animated.View 
                style={[
                  styles.labelScanLine,
                  {
                    transform: [{
                      translateY: scanLineAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-150, 150],
                      })
                    }]
                  }
                ]}
              />
            </View>
            <Text style={styles.labelGuideText}>Align shipping label within frame - barcode will be scanned automatically</Text>
          </View>
          
          {/* Controls positioned outside the label area */}
          <View style={styles.captureOverlay}>
            {!showTapToOcr ? (
              <TouchableOpacity 
                style={[styles.captureButton, isProcessing && styles.captureButtonDisabled]}
                onPress={takePicture}
                disabled={isProcessing}
                testID="capture-button"
              >
                <Text style={styles.captureButtonText}>
                  {isProcessing ? 'Processing...' : mode === 'training' ? 'Capture for Training' : 'Capture Label'}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.tapToOcrControls}>
                <TouchableOpacity 
                  style={styles.retryButton}
                  onPress={() => {
                    setShowTapToOcr(false);
                    setFreezeUri(null);
                  }}
                  testID="retry-capture-button"
                >
                  <Text style={styles.retryButtonText}>Retry Capture</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.acceptButton}
                  onPress={() => {
                    setShowTapToOcr(false);
                    setFreezeUri(null);
                  }}
                  testID="accept-result-button"
                >
                  <Text style={styles.acceptButtonText}>Accept Result</Text>
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity 
              style={[styles.torchButton, torchOn && styles.torchButtonOn]}
              onPress={() => {
                console.log('Torch button pressed, current state:', torchOn);
                setTorchOn((prev) => {
                  const newState = !prev;
                  console.log('Setting torch to:', newState);
                  return newState;
                });
              }}
              testID="torch-toggle"
            >
              <Text style={styles.torchButtonText}>{torchOn ? '🔦 ON' : '🔦 OFF'}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  message: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  labelOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  labelRectangle: {
    // 4x6 inch ratio (2:3) - adjusted for mobile screens
    width: '85%',
    aspectRatio: 2/3,
    maxWidth: 320,
    maxHeight: 480,
    borderWidth: 2,
    borderColor: '#10b981',
    borderRadius: 8,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  cornerTopLeft: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 20,
    height: 20,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#10b981',
    borderTopLeftRadius: 8,
  },
  cornerTopRight: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: '#10b981',
    borderTopRightRadius: 8,
  },
  cornerBottomLeft: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    width: 20,
    height: 20,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: '#10b981',
    borderBottomLeftRadius: 8,
  },
  cornerBottomRight: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: '#10b981',
    borderBottomRightRadius: 8,
  },
  labelGuideText: {
    color: '#10b981',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  captureOverlay: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  captureButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
    minWidth: 150,
    alignItems: 'center',
  },
  captureButtonDisabled: {
    backgroundColor: '#6b7280',
  },
  captureButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  torchButton: {
    marginTop: 12,
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  torchButtonOn: {
    backgroundColor: '#f59e0b',
  },
  torchButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  barcodeScanOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanLine: {
    width: '80%',
    height: 2,
    backgroundColor: '#ff4444',
    shadowColor: '#ff4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  labelScanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#ff4444',
    shadowColor: '#ff4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    top: '50%',
  },
  barcodeGuideText: {
    color: '#ff4444',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tapToOcrOverlay: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  tapToOcrText: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  tapIndicator: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#fff',
  },
  tapToOcrControls: {
    flexDirection: 'row',
    gap: 16,
  },
  retryButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  acceptButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});