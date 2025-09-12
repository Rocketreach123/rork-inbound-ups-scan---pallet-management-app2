import { DetectedBarcode, OcrLine, ParsedLabelPayload } from '@/types/warehouse';

// Utility functions for string processing
const upper = (s?: string) => (s || '').toUpperCase();
const nospace = (s?: string) => upper(s).replace(/[\s\-]+/g, '');
const cleanSpaces = (s?: string) => (s || '').replace(/\s+/g, ' ').trim();

// Enhanced UPS tracking number normalization
function normalize1Z(s: string): string | undefined {
  if (!s) return undefined;
  
  // Remove all spaces and dashes, then look for 1Z pattern
  const cleaned = s.replace(/[\s\-]+/g, '').toUpperCase();
  const match = cleaned.match(/1Z[A-Z0-9]{16}/);
  
  if (match) {
    return match[0];
  }
  
  // Try to find 1Z pattern with spaces/dashes in original string
  const spaceMatch = s.match(/1Z[\s\-]*([A-Z0-9][\s\-]*){16}/i);
  if (spaceMatch) {
    return spaceMatch[0].replace(/[\s\-]+/g, '').toUpperCase();
  }
  
  return undefined;
}

// Enhanced FedEx tracking number validation
function validateFedExTracking(s: string): string | undefined {
  if (!s) return undefined;
  
  const cleaned = s.replace(/[^0-9]/g, '');
  
  // FedEx tracking numbers are typically 12, 14, 15, 20, or 22 digits
  if ([12, 14, 15, 20, 22].includes(cleaned.length)) {
    return cleaned;
  }
  
  return undefined;
}

// Enhanced bottom carton code parsing
function parseBottomHuman(s: string): { packageBaseId?: string; cartonIndex?: string } {
  if (!s) return {};
  
  // Look for classic format: 87355595.001
  const dotMatch = s.match(/\b(\d{7,})\.(\d{3})\b/);
  if (dotMatch) {
    return { packageBaseId: dotMatch[1], cartonIndex: dotMatch[2] };
  }
  
  // Look for space-separated format: 08698 0656 001
  const spaceMatch = s.match(/\b(\d{4,})\s+(\d{4,})\s+(\d{3})\b/);
  if (spaceMatch) {
    return { packageBaseId: spaceMatch[1] + spaceMatch[2], cartonIndex: spaceMatch[3] };
  }
  
  // Extract all numbers and try to identify base ID (7+ digits) and carton (3 digits)
  const numbers = s.match(/\d+/g) || [];
  const baseId = numbers.find(n => n.length >= 7);
  const cartonId = numbers.find(n => n.length === 3);
  
  if (baseId && cartonId) {
    return { packageBaseId: baseId, cartonIndex: cartonId };
  }
  
  return {};
}

// Find the lowest positioned Code128 barcode (typically bottom of label)
function pickLowestCode128(codes: DetectedBarcode[]): DetectedBarcode | undefined {
  if (!codes.length) return undefined;
  
  const code128s = codes.filter(b => b.symbology === 'CODE_128');
  if (!code128s.length) return undefined;
  
  // Sort by yCenter (or bbox.y) descending to get the lowest one
  return code128s.sort((a, b) => {
    const aY = a.yCenter ?? a.bbox?.y ?? 0;
    const bY = b.yCenter ?? b.bbox?.y ?? 0;
    return bY - aY;
  })[0];
}

// Enhanced regex patterns for better matching
const PATTERNS = {
  // More flexible tracking patterns
  TRACKING: /(?:TRACKING|TRACK)\s*(?:#|NUM|NUMBER)?\s*:?\s*([A-Z0-9\s\-]{10,})/i,
  
  // Enhanced PO patterns - much more aggressive matching
  PO: /\bPO\s*:?\s*([A-Z0-9\-]{3,})/i,
  PO_ALT: /\b(?:PURCHASE\s*ORDER|P\.O\.|PO#)\s*:?\s*([A-Z0-9\-]{3,})/i,
  PO_LOOSE: /\bPO([A-Z0-9\-]{3,})/i, // PO directly followed by alphanumeric
  PO_COLON: /:?\s*PO\s*:?\s*([A-Z0-9\-]{3,})/i, // PO with optional colons
  
  // Reference patterns
  REF1: /\bREF\s*1?\s*:?\s*([A-Z0-9\/\-]{3,})/i,
  REF2: /\bREF\s*2\s*:?\s*([A-Z0-9\-]{3,})/i,
  REF3: /\bREF\s*3\s*:?\s*([A-Z0-9\-]{3,})/i,
  
  // Flag patterns
  PARTIAL: /\bPARTIAL\b/i,
  LANE: /\bLANE\s*[-–]?\s*([A-Z0-9])\b/i,
  
  // FedEx number pattern (more restrictive)
  FEDEX_NUM: /\b(\d{22}|\d{20}|\d{15}|\d{14}|\d{12})\b/
};

// Enhanced line finder with multiple pattern attempts
function findInOCR(lines: OcrLine[], patterns: RegExp[]): string | undefined {
  const allText = lines.map(l => l.text).join(' ');
  
  for (const pattern of patterns) {
    // Try each line individually first
    for (const line of lines) {
      const match = line.text?.match(pattern);
      if (match && match[1]) {
        return cleanSpaces(match[1]);
      }
    }
    
    // Then try the combined text
    const match = allText.match(pattern);
    if (match && match[1]) {
      return cleanSpaces(match[1]);
    }
  }
  
  return undefined;
}

// Main parsing function with enhanced logic
export function parseLabel(rawBarcodes: DetectedBarcode[], ocrLines: OcrLine[], imageUri?: string): ParsedLabelPayload {
  console.log('=== PARSING LABEL ===');
  console.log('Barcodes:', rawBarcodes.map(b => ({ value: b.value, type: b.symbology })));
  console.log('OCR Lines:', ocrLines.map(l => l.text));
  
  // Step 1: Extract tracking number (prioritize barcodes, then OCR)
  let tracking: string | undefined;
  let carrier: 'UPS' | 'FEDEX' | 'UNKNOWN' = 'UNKNOWN';
  
  // Check barcodes first for UPS tracking
  for (const barcode of rawBarcodes) {
    const upsTracking = normalize1Z(barcode.value);
    if (upsTracking) {
      tracking = upsTracking;
      carrier = 'UPS';
      console.log('Found UPS tracking in barcode:', tracking);
      break;
    }
  }
  
  // If no UPS found, check for FedEx in barcodes
  if (!tracking) {
    for (const barcode of rawBarcodes) {
      const fedexTracking = validateFedExTracking(barcode.value);
      if (fedexTracking) {
        tracking = fedexTracking;
        carrier = 'FEDEX';
        console.log('Found FedEx tracking in barcode:', tracking);
        break;
      }
    }
  }
  
  // If still no tracking, check OCR text
  if (!tracking) {
    const trackingText = findInOCR(ocrLines, [PATTERNS.TRACKING]);
    if (trackingText) {
      const upsFromOCR = normalize1Z(trackingText);
      if (upsFromOCR) {
        tracking = upsFromOCR;
        carrier = 'UPS';
        console.log('Found UPS tracking in OCR:', tracking);
      } else {
        const fedexFromOCR = validateFedExTracking(trackingText);
        if (fedexFromOCR) {
          tracking = fedexFromOCR;
          carrier = 'FEDEX';
          console.log('Found FedEx tracking in OCR:', tracking);
        }
      }
    }
  }
  
  // Step 2: Extract PO number with multiple patterns
  const poNumber = findInOCR(ocrLines, [PATTERNS.PO, PATTERNS.PO_ALT, PATTERNS.PO_LOOSE, PATTERNS.PO_COLON]);
  console.log('Found PO:', poNumber);
  
  // Step 3: Extract reference numbers
  const ref1Raw = findInOCR(ocrLines, [PATTERNS.REF1]);
  const ref2Raw = findInOCR(ocrLines, [PATTERNS.REF2]);
  const ref3Raw = findInOCR(ocrLines, [PATTERNS.REF3]);
  
  console.log('References:', { ref1Raw, ref2Raw, ref3Raw });
  
  // Process REF1 for prefix/id split
  let ref1Prefix: string | undefined;
  let ref1Id: string | undefined;
  let reference: string | undefined = ref1Raw;
  
  if (ref1Raw?.includes('/')) {
    const [prefix, id] = ref1Raw.split('/');
    ref1Prefix = nospace(prefix);
    ref1Id = nospace(id);
  }
  
  // Step 4: Extract bottom carton code
  const lowestBarcode = pickLowestCode128(rawBarcodes);
  const bottomText = `${lowestBarcode?.value || ''} ${ocrLines.slice(-5).map(l => l.text).join(' ')}`;
  const bottomParsed = parseBottomHuman(bottomText);
  
  console.log('Bottom parsing:', { bottomText: bottomText.substring(0, 50), bottomParsed });
  
  // Step 5: Extract flags
  const allOCRText = ocrLines.map(l => l.text).join(' ');
  const flags = {
    partial: PATTERNS.PARTIAL.test(allOCRText) || undefined,
    lane: allOCRText.match(PATTERNS.LANE)?.[1] || null
  };
  
  // Step 6: Calculate confidence
  let confidence = 0;
  let factors = 0;
  
  if (tracking) {
    confidence += 1;
    factors++;
  }
  
  if (poNumber) {
    confidence += 1;
    factors++;
  } else if (ref2Raw) {
    confidence += 0.7; // REF2 can sometimes be PO
    factors++;
  }
  
  if (bottomParsed.packageBaseId && bottomParsed.cartonIndex) {
    confidence += 0.8;
    factors++;
  }
  
  if (ref1Raw) {
    confidence += 0.5;
    factors++;
  }
  
  // Normalize confidence
  confidence = factors > 0 ? confidence / factors : 0;
  
  // Penalize if critical fields are missing
  if (!tracking) confidence *= 0.3;
  if (!poNumber && !ref2Raw) confidence *= 0.5;
  
  const result: ParsedLabelPayload = {
    carrier,
    imageUri,
    rawBarcodes,
    ocrLines,
    confidence,
    tracking,
    poNumber: poNumber ? nospace(poNumber) : undefined,
    reference: reference ? nospace(reference) : undefined,
    ref1Prefix,
    ref1Id,
    ref2: ref2Raw ? nospace(ref2Raw) : undefined,
    bottomRaw: (bottomParsed.packageBaseId && bottomParsed.cartonIndex) 
      ? `${bottomParsed.packageBaseId}.${bottomParsed.cartonIndex}` 
      : undefined,
    packageBaseId: bottomParsed.packageBaseId,
    cartonIndex: bottomParsed.cartonIndex,
    flags
  };
  
  console.log('=== PARSE RESULT ===');
  console.log('Tracking:', result.tracking);
  console.log('PO:', result.poNumber);
  console.log('Confidence:', result.confidence);
  console.log('Carrier:', result.carrier);
  
  return result;
}
