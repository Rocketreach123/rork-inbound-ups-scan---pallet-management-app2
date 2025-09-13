import { useState, useEffect, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { mockData } from '@/mocks/warehouse-data';
import { useApi } from '@/providers/api-provider';
import { 
  Package, 
  Pallet, 
  PurchaseOrder, 
  Location, 
  ScanEvent,
  WarehouseStats,
  Settings,
  ApiResponse,
  UnmatchedPallet
} from '@/types/warehouse';

interface WarehouseContextValue {
  // State
  packages: Package[];
  pallets: Pallet[];
  purchaseOrders: PurchaseOrder[];
  locations: Location[];
  scanEvents: ScanEvent[];
  stats: WarehouseStats;
  recentScans: ScanEvent[];
  settings: Settings;
  unmatchedPallet: UnmatchedPallet | null;
  // Device/active pallet
  activePalletId: string | null;
  activePallet: Pallet | null;
  setActivePalletById: (palletId: string) => Promise<boolean>;
  setActivePalletByCode: (palletCode: string) => Promise<boolean>;

  // Actions
  processPackageScan: (barcode: string) => Promise<any>;
  assignToPallet: (packageId: string, palletId: string) => Promise<boolean>;
  movePallet: (palletCode: string, locationCode: string) => Promise<boolean>;
  findPackage: (identifier: string) => Promise<any>;
  searchPackages: (query: string, type: 'tracking' | 'po' | 'pallet') => Package[];
  updateSettings: (updates: Partial<Settings>) => void;
  createPallet: (workDate: string, dayBucket: string, department: string) => Promise<Pallet>;
  createNamedPallet: (displayName: string) => Promise<Pallet>;
  printLicensePlate: (palletId: string) => Promise<boolean>;
  lookupPackageInApi: (tracking: string) => Promise<ApiResponse>;
  createUnmatchedPallet: () => Promise<UnmatchedPallet>;
  movePackageToUnmatched: (packageId: string) => Promise<boolean>;
  generatePalletBarcode: (palletCode: string) => string;
  matchPalletCodeFromScan: (data: string) => string | null;
}

export const [WarehouseProvider, useWarehouse] = createContextHook<WarehouseContextValue>(() => {
  const [packages, setPackages] = useState<Package[]>(mockData.packages);
  const [pallets, setPallets] = useState<Pallet[]>(mockData.pallets);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(mockData.purchaseOrders);
  const [locations, setLocations] = useState<Location[]>(mockData.locations);
  const [scanEvents, setScanEvents] = useState<ScanEvent[]>(mockData.scanEvents);
  const [settings, setSettings] = useState<Settings>({
    defaultPrinter: 'Zebra ZT410 - Dock 1',
    defaultZone: 'Z1',
    notifications: true,
    soundEffects: true,
  });
  const [unmatchedPallet, setUnmatchedPallet] = useState<UnmatchedPallet | null>(null);
  const [activePalletId, setActivePalletId] = useState<string | null>(null);

  // Load persisted data
  useEffect(() => {
    loadPersistedData();
  }, []);

  const loadPersistedData = async () => {
    try {
      const storedSettings = await AsyncStorage.getItem('warehouse_settings');
      if (storedSettings) {
        setSettings(JSON.parse(storedSettings));
      }
      
      const storedEvents = await AsyncStorage.getItem('scan_events');
      if (storedEvents) {
        setScanEvents(JSON.parse(storedEvents));
      }

      const storedActivePalletId = await AsyncStorage.getItem('active_pallet_id');
      if (storedActivePalletId) {
        setActivePalletId(storedActivePalletId);
      }
    } catch (error) {
      console.error('Error loading persisted data:', error);
    }
  };

  const saveSettings = useCallback(async (newSettings: Settings) => {
    try {
      await AsyncStorage.setItem('warehouse_settings', JSON.stringify(newSettings));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }, []);

  const saveScanEvent = useCallback(async (event: ScanEvent) => {
    const updatedEvents = [event, ...scanEvents].slice(0, 100); // Keep last 100 events
    setScanEvents(updatedEvents);
    try {
      await AsyncStorage.setItem('scan_events', JSON.stringify(updatedEvents));
    } catch (error) {
      console.error('Error saving scan event:', error);
    }
  }, [scanEvents]);

  const { isEnabled: apiEnabled, get, post } = useApi();

  const lookupPackageInApi = useCallback(async (tracking: string): Promise<ApiResponse> => {
    try {
      console.log('Looking up package in API:', tracking);
      if (apiEnabled) {
        const res = await get<ApiResponse>(`/packages/lookup`, { tracking });
        if (res?.success && res?.data) return res;
        return { success: false, error: (res as any)?.error ?? 'Package not found in database' };
      }
      // When API is not enabled, always return not found to avoid showing dummy data
      console.log('API not enabled - package will be moved to unmatched pallet');
      return { success: false, error: 'API not configured - package moved to unmatched pallet' };
    } catch (error) {
      console.error('API lookup error:', error);
      return { success: false, error: 'API connection failed' };
    }
  }, [apiEnabled, get]);

  const getNextLicensePlate = useCallback((): string => {
    const existing = pallets
      .map(p => p.palletCode)
      .filter(c => /^LP\d{6}$/.test(c))
      .map(c => parseInt(c.replace(/^LP/, ''), 10));
    const seed = 101000;
    const next = ((existing.length ? Math.max(...existing) : seed) + 1).toString().padStart(6, '0');
    return `LP${next}`;
  }, [pallets]);

  // Create unmatched pallet
  const createUnmatchedPallet = useCallback(async (): Promise<UnmatchedPallet> => {
    const today = new Date();
    const lpCode = getNextLicensePlate();
    const newUnmatchedPallet: UnmatchedPallet = {
      id: `unmatched-${Date.now()}`,
      palletCode: lpCode,
      packages: [],
      createdAt: today.toISOString(),
      needsManualReview: true,
    };
    
    setUnmatchedPallet(newUnmatchedPallet);
    
    const pallet: Pallet = {
      id: newUnmatchedPallet.id,
      palletCode: newUnmatchedPallet.palletCode,
      workDate: today.toISOString().split('T')[0],
      dayBucket: 'UNMATCHED',
      department: 'PENDING',
      state: 'OPEN',
      packageCount: 0,
      currentLocation: 'Z1/A01/B01/L1',
    };
    setPallets(prev => [...prev, pallet]);
    
    const event: ScanEvent = {
      id: `evt-${Date.now()}`,
      eventType: 'UNMATCHED_PALLET_CREATED',
      palletId: newUnmatchedPallet.id,
      palletCode: newUnmatchedPallet.palletCode,
      timestamp: today.toLocaleString(),
    };
    await saveScanEvent(event);
    
    return newUnmatchedPallet;
  }, [saveScanEvent, getNextLicensePlate]);

  // Move package to unmatched pallet
  const movePackageToUnmatched = useCallback(async (packageId: string): Promise<boolean> => {
    let targetUnmatchedPallet = unmatchedPallet;
    
    if (!targetUnmatchedPallet) {
      targetUnmatchedPallet = await createUnmatchedPallet();
    }
    
    const pkg = packages.find(p => p.id === packageId);
    if (!pkg) return false;
    
    // Update package
    const updatedPackage = { 
      ...pkg, 
      palletId: targetUnmatchedPallet.id,
      palletCode: targetUnmatchedPallet.palletCode,
      state: 'ASSIGNED' as const 
    };
    setPackages(prev => [...prev.filter(p => p.id !== packageId), updatedPackage]);
    
    // Update unmatched pallet
    const updatedUnmatchedPallet = {
      ...targetUnmatchedPallet,
      packages: [...targetUnmatchedPallet.packages, updatedPackage]
    };
    setUnmatchedPallet(updatedUnmatchedPallet);
    
    // Update regular pallet count
    setPallets(prev => prev.map(p => 
      p.id === targetUnmatchedPallet!.id 
        ? { ...p, packageCount: p.packageCount + 1 }
        : p
    ));
    
    const event: ScanEvent = {
      id: `evt-${Date.now()}`,
      eventType: 'MOVED_TO_UNMATCHED',
      packageId,
      palletId: targetUnmatchedPallet.id,
      tracking: pkg.tracking,
      palletCode: targetUnmatchedPallet.palletCode,
      timestamp: new Date().toLocaleString(),
    };
    await saveScanEvent(event);
    
    return true;
  }, [packages, unmatchedPallet, createUnmatchedPallet, saveScanEvent]);

  // Match pallet code string from scanned data
  const matchPalletCodeFromScan = useCallback((data: string): string | null => {
    if (!data) return null;
    const trimmed = data.trim();
    if (/^(?:PAL|LP)[:\-]/i.test(trimmed)) {
      const code = trimmed.replace(/^(?:PAL|LP)[:\-]/i, '').trim();
      return code || null;
    }
    const exact = pallets.find(p => p.palletCode.toUpperCase() === trimmed.toUpperCase());
    if (exact) return exact.palletCode;
    return null;
  }, [pallets]);

  // Generate license plate barcode
  const generatePalletBarcode = useCallback((palletCode: string): string => {
    const zpl = `^XA
^CF0,40
^FO40,40^FD LICENSE PLATE ${palletCode} ^FS
^FO40,90^FD DATE: ${new Date().toISOString().split('T')[0]} ^FS
^FO40,140^FD TYPE: LP ^FS
^BY3,3,80^FO40,200^BCN,100,Y,N,N
^FD LP:${palletCode} ^FS
^FO300,200^BQN,2,8
^FDQA,aca://lp/${palletCode}^FS
^XZ`;
    console.log('Generated ZPL for LP:', palletCode);
    console.log(zpl);
    return zpl;
  }, []);

  // Print license plate (ZPL debug + event)
  const printLicensePlate = useCallback(async (palletId: string): Promise<boolean> => {
    const pallet = pallets.find(p => p.id === palletId);
    if (!pallet) return false;
    const zpl = generatePalletBarcode(pallet.palletCode);
    console.log('PRINT ZPL:\n', zpl);
    const event: ScanEvent = {
      id: `evt-${Date.now()}`,
      eventType: 'LICENSE_PLATE_PRINTED',
      palletId: pallet.id,
      palletCode: pallet.palletCode,
      timestamp: new Date().toLocaleString(),
    };
    await saveScanEvent(event);
    return true;
  }, [pallets, generatePalletBarcode, saveScanEvent]);

  // Assign package to pallet with improved state handling
  const assignToPallet = useCallback(async (packageId: string, palletId: string): Promise<boolean> => {
    console.log('=== ASSIGN TO PALLET ===');
    console.log('Package ID:', packageId);
    console.log('Pallet ID:', palletId);
    
    if (!packageId || typeof packageId !== 'string') {
      console.error('Invalid package ID:', packageId);
      return false;
    }
    if (!palletId || typeof palletId !== 'string') {
      console.error('Invalid pallet ID:', palletId);
      return false;
    }
    try {
      const pkg = packages.find(p => p.id === packageId);
      const pallet = pallets.find(p => p.id === palletId);
      console.log('Available packages:', packages.map(p => ({ id: p.id, tracking: p.tracking, state: p.state })));
      console.log('Available pallets:', pallets.map(p => ({ id: p.id, code: p.palletCode, state: p.state })));
      console.log('Found package:', pkg ? { id: pkg.id, tracking: pkg.tracking, state: pkg.state } : 'NOT FOUND');
      console.log('Found pallet:', pallet ? { id: pallet.id, code: pallet.palletCode, state: pallet.state } : 'NOT FOUND');
      if (!pkg) {
        console.error('Package not found in packages array:', packageId);
        return false;
      }
      if (!pallet) {
        console.error('Pallet not found in pallets array:', palletId);
        return false;
      }
      if (pkg.state === 'ASSIGNED' && pkg.palletId) {
        console.warn('Package is already assigned to pallet:', pkg.palletId);
        if (pkg.palletId === palletId) return true;
      }
      const updatedPackage = { 
        ...pkg, 
        palletId, 
        palletCode: pallet.palletCode, 
        state: 'ASSIGNED' as const,
        location: pallet.currentLocation
      };
      setPackages(currentPackages => {
        const filtered = currentPackages.filter(p => p.id !== packageId);
        const updated = [...filtered, updatedPackage];
        return updated;
      });
      setPallets(currentPallets => {
        const updated = currentPallets.map(p => 
          p.id === palletId 
            ? { ...p, packageCount: p.packageCount + 1 }
            : p
        );
        return updated;
      });
      const event: ScanEvent = {
        id: `evt-${Date.now()}`,
        eventType: 'ASSIGNED_TO_PALLET',
        packageId,
        palletId,
        tracking: pkg.tracking,
        poNumber: pkg.poNumber,
        palletCode: pallet.palletCode,
        timestamp: new Date().toLocaleString(),
      };
      await saveScanEvent(event);
      if (apiEnabled) {
        try {
          await post(`/packages/${packageId}/assign`, { palletId });
        } catch (e) {
          console.warn('Remote assign failed, kept local state', e);
        }
      }
      return true;
    } catch (error) {
      console.error('Assignment error:', error);
      return false;
    }
  }, [packages, pallets, saveScanEvent, apiEnabled, post]);

  // Process package scan with API integration
  const processPackageScan = useCallback(async (barcode: string): Promise<any> => {
    try {
      let tracking = barcode;
      if (barcode.includes('1Z')) {
        const match = barcode.match(/1Z[A-Z0-9]{16}/);
        if (match) {
          tracking = match[0];
        }
      }
      console.log('Processing package scan:', tracking);
      const apiResponse = await lookupPackageInApi(tracking);
      let po: PurchaseOrder;
      let apiMatched = false;
      let contents: string | undefined;
      let weight: number | undefined;
      let dimensions: any;
      if (apiResponse.success && apiResponse.data) {
        apiMatched = true;
        const apiData = apiResponse.data;
        contents = apiData.contents;
        weight = apiData.weight;
        dimensions = apiData.dimensions;
        po = purchaseOrders.find(p => p.poNumber === apiData.poNumber) || {
          id: `po-${Date.now()}`,
          poNumber: apiData.poNumber,
          dueDate: apiData.expectedDeliveryDate || new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          vendorName: apiData.vendor || 'Unknown Vendor',
          department: 'EMB',
          priority: 'NORMAL',
          status: 'OPEN',
        };
        if (!purchaseOrders.find(p => p.poNumber === po.poNumber)) {
          setPurchaseOrders(prev => [...prev, po]);
        }
      } else {
        console.log('Package not found in API, will be moved to unmatched pallet');
        po = {
          id: `po-unmatched-${Date.now()}`,
          poNumber: 'UNMATCHED',
          dueDate: new Date().toISOString().split('T')[0],
          vendorName: 'Unknown',
          department: 'PENDING',
          priority: 'NORMAL',
          status: 'OPEN',
        };
      }
      let pallet: Pallet;
      let created = false;
      if (apiMatched) {
        const existingOpen = pallets.find(p => p.state === 'OPEN');
        if (existingOpen) {
          pallet = existingOpen;
        } else {
          pallet = {
            id: `pal-${Date.now()}`,
            palletCode: getNextLicensePlate(),
            workDate: new Date().toISOString().split('T')[0],
            dayBucket: 'AUTO',
            department: po.department,
            state: 'OPEN',
            packageCount: 0,
            currentLocation: 'Z1/A01/B01/L1',
          };
          setPallets(prev => [...prev, pallet]);
          created = true;
        }
      } else {
        let targetUnmatchedPallet = unmatchedPallet;
        if (!targetUnmatchedPallet) {
          targetUnmatchedPallet = await createUnmatchedPallet();
        }
        pallet = {
          id: targetUnmatchedPallet.id,
          palletCode: targetUnmatchedPallet.palletCode,
          workDate: new Date().toISOString().split('T')[0],
          dayBucket: 'UNMATCHED',
          department: 'PENDING',
          state: 'OPEN',
          packageCount: 0,
          currentLocation: 'Z1/A01/B01/L1',
        };
      }
      const newPackage: Package = {
        id: `pkg-${Date.now()}`,
        tracking,
        poNumber: po.poNumber,
        poId: po.id,
        palletId: pallet.id,
        palletCode: pallet.palletCode,
        state: 'SCANNED',
        location: pallet.currentLocation,
        timestamp: new Date().toISOString(),
        apiMatched,
        contents,
        weight,
        dimensions,
      };
      setPackages(prev => [...prev, newPackage]);
      const scanEvent: ScanEvent = {
        id: `evt-${Date.now()}`,
        eventType: apiMatched ? 'PACKAGE_SCANNED' : 'UNMATCHED_PACKAGE_SCANNED',
        packageId: newPackage.id,
        palletId: pallet.id,
        tracking,
        poNumber: po.poNumber,
        palletCode: pallet.palletCode,
        timestamp: new Date().toLocaleString(),
      };
      await saveScanEvent(scanEvent);
      const result = {
        package: newPackage,
        po,
        suggestedPallet: { ...pallet, created },
        apiMatched,
        apiError: !apiMatched ? apiResponse.error : undefined,
      };
      console.log('Process package scan result:', result);
      if (activePalletId && activePalletId !== pallet.id) {
        await assignToPallet(newPackage.id, activePalletId);
      }
      return result;
    } catch (error) {
      console.error('Error in processPackageScan:', error);
      throw error;
    }
  }, [lookupPackageInApi, purchaseOrders, pallets, unmatchedPallet, createUnmatchedPallet, saveScanEvent, activePalletId, assignToPallet]);

  // Create pallet
  const createPallet = useCallback(async (workDate: string, dayBucket: string, department: string): Promise<Pallet> => {
    const today = new Date();
    const palletCode = getNextLicensePlate();

    const newPallet: Pallet = {
      id: `pal-${Date.now()}`,
      palletCode,
      workDate,
      dayBucket,
      department,
      state: 'OPEN',
      packageCount: 0,
      currentLocation: 'Z1/A01/B01/L1',
    };
    setPallets(prev => [...prev, newPallet]);

    const event: ScanEvent = {
      id: `evt-${Date.now()}`,
      eventType: 'PALLET_CREATED',
      palletId: newPallet.id,
      palletCode: newPallet.palletCode,
      timestamp: today.toLocaleString(),
    };
    await saveScanEvent(event);
    return newPallet;
  }, [pallets, saveScanEvent, getNextLicensePlate]);

  // Create named pallet quickly and set as OPEN
  const createNamedPallet = useCallback(async (_displayName: string): Promise<Pallet> => {
    const today = new Date().toISOString().split('T')[0];
    const code = getNextLicensePlate();
    const p: Pallet = {
      id: `pal-${Date.now()}`,
      palletCode: code,
      workDate: today,
      dayBucket: 'MANUAL',
      department: 'WAREHOUSE',
      state: 'OPEN',
      packageCount: 0,
      currentLocation: 'Z1/A01/B01/L1',
    };
    setPallets(prev => [...prev, p]);
    const event: ScanEvent = {
      id: `evt-${Date.now()}`,
      eventType: 'PALLET_CREATED',
      palletId: p.id,
      palletCode: p.palletCode,
      timestamp: new Date().toLocaleString(),
    };
    await saveScanEvent(event);
    return p;
  }, [pallets, saveScanEvent, getNextLicensePlate]);

  // Move pallet to location
  const movePallet = useCallback(async (palletCode: string, locationCode: string): Promise<boolean> => {
    const pallet = pallets.find(p => p.palletCode === palletCode);
    const location = locations.find(l => l.code === locationCode);
    
    if (!pallet || !location) return false;
    
    // Update pallet location
    setPallets(prev => prev.map(p => 
      p.id === pallet.id 
        ? { ...p, currentLocation: location.code }
        : p
    ));
    
    // Update location
    setLocations(prev => prev.map(l => 
      l.id === location.id 
        ? { ...l, currentPallet: palletCode }
        : l
    ));
    
    // Log event
    const event: ScanEvent = {
      id: `evt-${Date.now()}`,
      eventType: 'PALLET_MOVED',
      palletId: pallet.id,
      locationId: location.id,
      palletCode,
      timestamp: new Date().toLocaleString(),
    };
    
    await saveScanEvent(event);
    return true;
  }, [pallets, locations, saveScanEvent]);

  // Find package
  const findPackage = useCallback(async (identifier: string): Promise<any> => {
    // Search by tracking, PO, or order
    const pkg = packages.find(p => 
      p.tracking === identifier || 
      p.poNumber === identifier
    );
    
    if (!pkg) {
      return { found: false, reason: 'NEVER_SCANNED' };
    }
    
    const pallet = pallets.find(p => p.id === pkg.palletId);
    const location = locations.find(l => l.code === pallet?.currentLocation);
    
    if (!pallet || !location) {
      return { found: false, reason: 'NO_LOCATION' };
    }
    
    // Generate route hints
    const routeHint = [
      `From DOCK → Zone ${location.zone}`,
      `Go to Aisle ${location.aisle.replace('A', '')}`,
      `Find Bay ${location.bay.replace('B', '')}`,
      `Look at Level ${location.level.replace('L', '')}`,
    ];
    
    return {
      found: true,
      pallet,
      location,
      routeHint,
      lastSeen: pkg.timestamp,
    };
  }, [packages, pallets, locations]);

  // Search packages
  const searchPackages = useCallback((query: string, type: 'tracking' | 'po' | 'pallet'): Package[] => {
    if (!query) return [];
    
    const upperQuery = query.toUpperCase();
    
    switch (type) {
      case 'tracking':
        return packages.filter(p => p.tracking.includes(upperQuery));
      case 'po':
        return packages.filter(p => p.poNumber.includes(upperQuery));
      case 'pallet':
        return packages.filter(p => p.palletCode?.includes(upperQuery));
      default:
        return [];
    }
  }, [packages]);

  // Update settings
  const updateSettings = useCallback((updates: Partial<Settings>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    saveSettings(newSettings);
  }, [settings, saveSettings]);

  // Calculate stats
  const stats: WarehouseStats = useMemo(() => ({
    todayScans: scanEvents.filter(e => {
      const eventDate = new Date(e.timestamp).toDateString();
      const today = new Date().toDateString();
      return eventDate === today;
    }).length,
    activePallets: pallets.filter(p => p.state === 'OPEN').length,
    pendingPackages: packages.filter(p => p.state === 'SCANNED').length,
  }), [scanEvents, pallets, packages]);

  // Get recent scans
  const recentScans = useMemo(() => 
    scanEvents.slice(0, 5),
    [scanEvents]
  );

  const activePallet = useMemo(() => pallets.find(p => p.id === activePalletId) ?? null, [pallets, activePalletId]);

  const setActivePalletById = useCallback(async (palletId: string): Promise<boolean> => {
    const exists = pallets.some(p => p.id === palletId);
    if (!exists) return false;
    setActivePalletId(palletId);
    try { await AsyncStorage.setItem('active_pallet_id', palletId); } catch {}
    const event: ScanEvent = {
      id: `evt-${Date.now()}`,
      eventType: 'ACTIVE_PALLET_SET',
      palletId,
      palletCode: pallets.find(p => p.id === palletId)?.palletCode,
      timestamp: new Date().toLocaleString(),
    };
    await saveScanEvent(event);
    return true;
  }, [pallets, saveScanEvent]);

  const setActivePalletByCode = useCallback(async (palletCode: string): Promise<boolean> => {
    const pal = pallets.find(p => p.palletCode.toUpperCase() === palletCode.toUpperCase());
    if (!pal) return false;
    return setActivePalletById(pal.id);
  }, [pallets, setActivePalletById]);

  return useMemo(() => ({
    packages,
    pallets,
    purchaseOrders,
    locations,
    scanEvents,
    stats,
    recentScans,
    settings,
    unmatchedPallet,
    activePalletId,
    activePallet,
    setActivePalletById,
    setActivePalletByCode,
    processPackageScan,
    assignToPallet,
    movePallet,
    findPackage,
    searchPackages,
    updateSettings,
    createPallet,
    createNamedPallet,
    printLicensePlate,
    lookupPackageInApi,
    createUnmatchedPallet,
    movePackageToUnmatched,
    generatePalletBarcode,
    matchPalletCodeFromScan,
  }), [
    packages,
    pallets,
    purchaseOrders,
    locations,
    scanEvents,
    stats,
    recentScans,
    settings,
    unmatchedPallet,
    activePalletId,
    activePallet,
    setActivePalletById,
    setActivePalletByCode,
    processPackageScan,
    assignToPallet,
    movePallet,
    findPackage,
    searchPackages,
    updateSettings,
    createPallet,
    createNamedPallet,
    printLicensePlate,
    lookupPackageInApi,
    createUnmatchedPallet,
    movePackageToUnmatched,
    generatePalletBarcode,
    matchPalletCodeFromScan,
  ]);
});