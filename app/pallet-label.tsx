import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, Platform, ScrollView } from 'react-native';
import { useWarehouse } from '@/providers/warehouse-provider';
import { Package, Printer } from 'lucide-react-native';

interface ZPLPreviewProps {
  palletCode: string;
}

function ZPLPreview({ palletCode }: ZPLPreviewProps) {
  const zpl = useMemo(() => {
    const workDate = new Date().toISOString().split('T')[0];
    return `^XA\n^CF0,40\n^FO40,40^FD PALLET ${palletCode} ^FS\n^FO40,90^FD WORK DATE: ${workDate} ^FS\n^FO40,140^FD BUCKET: AUTO  DEPT: AUTO ^FS\n^BY3,3,80^FO40,200^BCN,100,Y,N,N\n^FD PAL:${palletCode} ^FS\n^FO300,200^BQN,2,8\n^FDQA,aca://pallet/${encodeURIComponent(palletCode)}^FS\n^XZ`;
  }, [palletCode]);

  return (
    <View style={styles.zplBox} testID="zpl-preview">
      <Text selectable style={styles.zplText}>{zpl}</Text>
    </View>
  );
}

export default function PalletLabelScreen() {
  const { pallets, createPallet } = useWarehouse();
  const [dayBucket, setDayBucket] = useState<string>('TODAY');
  const [department, setDepartment] = useState<string>('EMB');
  const [workDate, setWorkDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const nextCode = useMemo(() => {
    const base = `PAL-${workDate}-${dayBucket}-${department}`;
    const exists = pallets.some(p => p.palletCode === base);
    if (!exists) return base;
    let i = 2;
    let candidate = `${base}-${i}`;
    while (pallets.some(p => p.palletCode === candidate)) {
      i += 1;
      candidate = `${base}-${i}`;
    }
    return candidate;
  }, [pallets, workDate, dayBucket, department]);

  const handlePrint = () => {
    Alert.alert('Print', 'Sending ZPL to printer...');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Package color="#1e40af" size={24} />
          <Text style={styles.title}>Create Pallet Label</Text>
        </View>

        <View style={styles.row}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Work Date (YYYY-MM-DD)</Text>
            <TextInput
              testID="input-work-date"
              value={workDate}
              onChangeText={setWorkDate}
              placeholder="2025-09-02"
              style={styles.input}
              keyboardType={Platform.OS === 'web' ? 'default' : 'numbers-and-punctuation'}
            />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.inputGroupHalf}>
            <Text style={styles.label}>Day Bucket</Text>
            <TextInput
              testID="input-day-bucket"
              value={dayBucket}
              onChangeText={setDayBucket}
              placeholder="TODAY | TOMORROW | MON | TUE | NEXT-WEEK"
              style={styles.input}
            />
          </View>
          <View style={styles.inputGroupHalf}>
            <Text style={styles.label}>Department</Text>
            <TextInput
              testID="input-department"
              value={department}
              onChangeText={setDepartment}
              placeholder="SP | EMB | FULF"
              style={styles.input}
              autoCapitalize="characters"
            />
          </View>
        </View>

        <View style={styles.preview}>
          <Text style={styles.previewLabel}>Pallet Code</Text>
          <Text selectable style={styles.code} testID="pallet-code">{nextCode}</Text>
        </View>

        <ZPLPreview palletCode={nextCode} />

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.primary]}
            onPress={async () => {
              try {
                const p = await createPallet(workDate, dayBucket.toUpperCase(), department.toUpperCase());
                Alert.alert('Pallet Created', p.palletCode);
              } catch (e) {
                Alert.alert('Error', 'Failed to create pallet');
              }
            }}
            testID="create-pallet-confirm"
          >
            <Package color="#fff" size={20} />
            <Text style={styles.primaryText}>Create Pallet</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.button, styles.secondary]} onPress={handlePrint} testID="print-zpl">
            <Printer color="#1e40af" size={20} />
            <Text style={styles.secondaryText}>Send ZPL to Printer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  content: { padding: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
      android: { elevation: 3 },
    }),
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '700', color: '#111827', marginLeft: 8 },
  row: { flexDirection: 'row', gap: 12 },
  inputGroup: { flex: 1, marginBottom: 12 },
  inputGroupHalf: { flex: 1, marginBottom: 12 },
  label: { fontSize: 12, color: '#6b7280', marginBottom: 6 },
  input: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111827' },
  preview: { marginTop: 8, marginBottom: 12 },
  previewLabel: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  code: { fontSize: 16, fontWeight: '700', color: '#1e40af' },
  zplBox: { backgroundColor: '#0f172a', borderRadius: 8, padding: 12, marginTop: 8 },
  zplText: { color: '#e5e7eb', fontFamily: Platform.OS === 'web' ? 'monospace' : undefined, fontSize: 12 },
  actions: { marginTop: 16, gap: 12 },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 8 },
  primary: { backgroundColor: '#10b981' },
  secondary: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#93c5fd' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700', marginLeft: 8 },
  secondaryText: { color: '#1e40af', fontSize: 16, fontWeight: '700', marginLeft: 8 },
});