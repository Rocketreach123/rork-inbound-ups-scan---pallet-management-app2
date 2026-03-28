export interface Package {
  id: string;
  tracking: string;
  poNumber: string;
  poId: string;
  palletId: string | null;
  palletCode: string | null;
  state: 'SCANNED' | 'ASSIGNED' | 'FOUND' | 'RELOCATED';
  location?: string;
  timestamp: string;
  apiMatched: boolean;
  contents?: string;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
}

export interface Pallet {
  id: string;
  palletCode: string;
  workDate: string;
  dayBucket: string;
  department: string;
  state: 'OPEN' | 'CLOSED';
  packageCount: number;
  currentLocation?: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  dueDate: string;
  vendorName?: string;
  department: string;
  priority: 'NORMAL' | 'RUSH';
  status: 'OPEN' | 'PARTIAL' | 'RECEIVED' | 'CLOSED';
  expectedPackages?: number;
  receivedPackages?: number;
  totalValue?: number;
}

export interface Location {
  id: string;
  code: string;
  zone: string;
  aisle: string;
  bay: string;
  level: string;
  currentPallet?: string;
}

export interface ScanEvent {
  id: string;
  eventType: string;
  packageId?: string;
  palletId?: string;
  locationId?: string;
  tracking?: string;
  poNumber?: string;
  palletCode?: string;
  timestamp: string;
}

export interface WarehouseStats {
  todayScans: number;
  activePallets: number;
  pendingPackages: number;
}

export interface Settings {
  defaultPrinter?: string;
  defaultZone?: string;
  notifications: boolean;
  soundEffects: boolean;
}

export interface RoutingRule {
  id: string;
  name: string;
  department: 'ANY' | 'SP' | 'EMB' | 'FULF';
  priority: 'ANY' | 'NORMAL' | 'RUSH';
  daysAheadMin: number;
  daysAheadMax: number;
  bucketLabel: string;
  enabled: boolean;
  rank: number;
}

export type Symbology = 'CODE_128' | 'CODE_39' | 'QR' | 'PDF_417' | 'DATAMATRIX' | 'EAN_13' | 'UPC_A';

export interface DetectedBarcode {
  value: string;
  symbology: Symbology;
  bbox?: { x: number; y: number; w: number; h: number };
  yCenter?: number;
}

export interface OcrLine {
  text: string;
  conf?: number;
  bbox?: { x: number; y: number; w: number; h: number };
}

export interface TrainingData {
  id: string;
  imageUri: string;
  extractedData: {
    carrier?: 'UPS' | 'FEDEX' | 'UNKNOWN';
    tracking?: string;
    poNumber?: string;
    reference?: string;
    ref1Prefix?: string;
    ref1Id?: string;
    ref2?: string;
    bottomRaw?: string;
    packageBaseId?: string;
    cartonIndex?: string;
    vendor?: string;
    flags?: { partial?: boolean; lane?: string | null };
  };
  correctedData?: {
    tracking?: string;
    poNumber?: string;
    reference?: string;
    vendor?: string;
  };
  confidence: number;
  timestamp: string;
  status: 'pending' | 'verified' | 'corrected';
  rawBarcodes?: DetectedBarcode[];
  ocrLines?: OcrLine[];
  ocrText?: string;
  lookup?: Record<string, unknown> | undefined;
}

export interface BatchScanSession {
  id: string;
  startTime: string;
  endTime?: string;
  packagesScanned: number;
  errorsCount: number;
  status: 'active' | 'paused' | 'completed';
  packages: Package[];
}

export interface ScanError {
  id: string;
  packageId: string;
  errorType: 'missing_po' | 'invalid_tracking' | 'duplicate_scan' | 'ocr_failed' | 'barcode_unreadable';
  message: string;
  timestamp: string;
  resolved: boolean;
  resolution?: string;
}

export interface LabelExtractionResult {
  imageUri?: string;
  rawBarcodes: DetectedBarcode[];
  ocrLines: OcrLine[];
}

export interface ParsedLabelPayload {
  carrier: 'UPS' | 'FEDEX' | 'UNKNOWN';
  tracking?: string;
  poNumber?: string;
  reference?: string;
  ref1Prefix?: string;
  ref1Id?: string;
  ref2?: string;
  bottomRaw?: string;
  packageBaseId?: string;
  cartonIndex?: string;
  flags: { partial?: boolean; lane?: string | null };
  confidence: number;
  rawBarcodes: DetectedBarcode[];
  ocrLines: OcrLine[];
  imageUri?: string;
  lookup?: Record<string, unknown>;
}

export interface ApiPackageData {
  tracking: string;
  poNumber: string;
  contents: string;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  vendor?: string;
  expectedDeliveryDate?: string;
}

export interface ApiResponse {
  success: boolean;
  data?: ApiPackageData;
  error?: string;
}

export interface UnmatchedPallet {
  id: string;
  palletCode: string;
  packages: Package[];
  createdAt: string;
  needsManualReview: boolean;
}