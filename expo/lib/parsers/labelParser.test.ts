/// <reference path="../../types/test-globals.ts" />
import { parseLabel } from './labelParser';
import { DetectedBarcode, OcrLine } from '@/types/warehouse';

// Mock console.log to avoid test output noise
const originalLog = console.log;
beforeAll(() => {
  console.log = jest.fn();
});

afterAll(() => {
  console.log = originalLog;
});

describe('Label Parser', () => {
  test('Custom Ink UPS label parses correctly', () => {
    const ocrLines: OcrLine[] = [
      { text: 'UPS GROUND' },
      { text: 'TRACKING #: 1Z 1Y7 98F 03 0170 0550' },
      { text: 'BILLING: P/P' },
      { text: 'REF1: 82427365A' },
      { text: 'REF2: SO-152023056' },
      { text: 'REF3: LP0149928586' },
      { text: 'PO: 82427365A' },
    ];
    const rawBarcodes: DetectedBarcode[] = [
      { value: '1Z1Y798F0301700550', symbology: 'CODE_128', yCenter: 300 },
    ];
    const parsed = parseLabel(rawBarcodes, ocrLines, 'mock://');

    expect(parsed.tracking).toBe('1Z1Y798F0301700550');
    expect(parsed.poNumber).toBe('82427365A');
    expect(parsed.ref2).toBe('SO152023056'); // Spaces/dashes removed
    expect(parsed.reference).toBe('82427365A');
    expect(parsed.confidence).toBeGreaterThanOrEqual(0.8);
    expect(parsed.carrier).toBe('UPS');
  });

  test('FedEx label parses correctly', () => {
    const ocrLines: OcrLine[] = [
      { text: 'FEDEX EXPRESS' },
      { text: 'TRACKING: 123456789012' },
      { text: 'PO: TEST123' },
      { text: 'REF: FEDEX-REF' }
    ];
    const rawBarcodes: DetectedBarcode[] = [
      { value: '123456789012', symbology: 'CODE_128', yCenter: 200 },
    ];
    const parsed = parseLabel(rawBarcodes, ocrLines, 'mock://');

    expect(parsed.tracking).toBe('123456789012');
    expect(parsed.poNumber).toBe('TEST123');
    expect(parsed.carrier).toBe('FEDEX');
    expect(parsed.confidence).toBeGreaterThan(0.5);
  });

  test('Handles missing tracking gracefully', () => {
    const ocrLines: OcrLine[] = [
      { text: 'SOME LABEL' },
      { text: 'PO: ABC123' }
    ];
    const rawBarcodes: DetectedBarcode[] = [];
    const parsed = parseLabel(rawBarcodes, ocrLines, 'mock://');

    expect(parsed.tracking).toBeUndefined();
    expect(parsed.poNumber).toBe('ABC123');
    expect(parsed.carrier).toBe('UNKNOWN');
    expect(parsed.confidence).toBeLessThan(0.5); // Low confidence without tracking
  });

  test('Handles missing PO gracefully', () => {
    const ocrLines: OcrLine[] = [
      { text: 'UPS GROUND' },
      { text: 'TRACKING: 1Z1Y798F0301700550' }
    ];
    const rawBarcodes: DetectedBarcode[] = [
      { value: '1Z1Y798F0301700550', symbology: 'CODE_128', yCenter: 300 },
    ];
    const parsed = parseLabel(rawBarcodes, ocrLines, 'mock://');

    expect(parsed.tracking).toBe('1Z1Y798F0301700550');
    expect(parsed.poNumber).toBeUndefined();
    expect(parsed.carrier).toBe('UPS');
    expect(parsed.confidence).toBeLessThan(0.8); // Lower confidence without PO
  });
});
