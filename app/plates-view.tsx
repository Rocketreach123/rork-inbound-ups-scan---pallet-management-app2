import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList, TouchableOpacity, SafeAreaView } from 'react-native';
import { Truck, RefreshCcw, CheckCircle2, AlertCircle, MapPin } from 'lucide-react-native';
import { usePlates } from '@/stores/platesSlice';
import { useLocations } from '@/stores/locationsSlice';

export default function PlatesView() {
  const { plates, refresh, health, manualRefreshing } = usePlates();
  const { locations } = useLocations();
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const locationMap = useMemo(() => {
    const map = new Map<string, string>();
    locations.forEach(loc => {
      map.set(loc.id, loc.name);
    });
    return map;
  }, [locations]);

  const data = useMemo(() => {
    const s = search.trim().toLowerCase();
    return plates.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (!s) return true;
      return (
        (p.plate_number?.toLowerCase().includes(s) ?? false) ||
        (p.state?.toLowerCase().includes(s) ?? false)
      );
    });
  }, [plates, search, statusFilter]);

  const SyncDot = () => {
    const color = health === 'green' ? '#10b981' : health === 'yellow' ? '#f59e0b' : '#ef4444';
    return <View style={[styles.dot, { backgroundColor: color }]} testID="sync-dot" />;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Truck color="#1f2937" size={18} />
          <Text style={styles.title}>License Plates</Text>
          <SyncDot />
          <TouchableOpacity onPress={() => refresh(true)} style={styles.refresh} testID="refresh-plates">
            <RefreshCcw color="#1e40af" size={18} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchRow}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search plates..."
            style={styles.input}
          />
          <TouchableOpacity 
            style={[styles.chip, statusFilter !== 'all' && styles.chipActive]} 
            onPress={() => setStatusFilter(statusFilter === 'all' ? 'ACTIVE' : 'all')}
          >
            {statusFilter !== 'all' ? <CheckCircle2 color="#10b981" size={16} /> : <AlertCircle color="#6b7280" size={16} />}
            <Text style={styles.chipText}>{statusFilter === 'all' ? 'All' : 'Filtered'}</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.rowContent}>
                <Text style={styles.plateNumber}>{item.plate_number}</Text>
                <View style={styles.rowDetails}>
                  {item.state && (
                    <Text style={styles.state}>{item.state}</Text>
                  )}
                  {item.location_id && (
                    <View style={styles.locationInfo}>
                      <MapPin color="#6b7280" size={12} />
                      <Text style={styles.locationText}>
                        {locationMap.get(item.location_id) || item.location_id}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              {item.status && (
                <View style={[styles.statusBadge, item.status === 'ACTIVE' && styles.statusActive]}>
                  <Text style={styles.statusText}>{item.status}</Text>
                </View>
              )}
            </View>
          )}
          refreshing={manualRefreshing}
          onRefresh={() => refresh(true)}
          contentContainerStyle={{ paddingBottom: 16 }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  title: { marginLeft: 8, fontWeight: '700', color: '#111827', fontSize: 16 },
  refresh: { marginLeft: 'auto' },
  dot: { width: 10, height: 10, borderRadius: 5, marginLeft: 8 },
  searchRow: { flexDirection: 'row', padding: 12, gap: 8 },
  input: { flex: 1, backgroundColor: '#f3f4f6', borderRadius: 8, paddingHorizontal: 12, height: 40 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#f3f4f6' },
  chipActive: { backgroundColor: '#ecfdf5' },
  chipText: { marginLeft: 6, color: '#111827', fontWeight: '600' },
  row: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    paddingHorizontal: 12, 
    paddingVertical: 10, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f3f4f6' 
  },
  rowContent: { flex: 1 },
  plateNumber: { fontSize: 14, color: '#111827', fontWeight: '600' },
  rowDetails: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 12 },
  state: { fontSize: 12, color: '#6b7280' },
  locationInfo: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { fontSize: 12, color: '#6b7280' },
  statusBadge: { 
    backgroundColor: '#f3f4f6', 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 4 
  },
  statusActive: { backgroundColor: '#ecfdf5' },
  statusText: { fontSize: 11, fontWeight: '600', color: '#6b7280' },
});