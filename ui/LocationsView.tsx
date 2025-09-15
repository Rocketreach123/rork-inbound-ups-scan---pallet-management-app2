import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { MapPin, RefreshCcw, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { useLocations } from '@/stores/locationsSlice';

export default function LocationsView() {
  const { locations, refresh, health, manualRefreshing } = useLocations();
  const [search, setSearch] = useState<string>('');
  const [activeOnly, setActiveOnly] = useState<boolean>(false);

  const data = useMemo(() => {
    const s = search.trim().toLowerCase();
    return locations.filter((l) => {
      if (activeOnly && l.active === false) return false;
      if (!s) return true;
      return (
        (l.name?.toLowerCase().includes(s) ?? false) ||
        (l.code?.toLowerCase().includes(s) ?? false)
      );
    });
  }, [locations, search, activeOnly]);

  const SyncDot = () => {
    const color = health === 'green' ? '#10b981' : health === 'yellow' ? '#f59e0b' : '#ef4444';
    return <View style={[styles.dot, { backgroundColor: color }]} testID="sync-dot" />;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MapPin color="#1f2937" size={18} />
        <Text style={styles.title}>Locations</Text>
        <SyncDot />
        <TouchableOpacity onPress={() => refresh(true)} style={styles.refresh} testID="refresh-locations">
          <RefreshCcw color="#1e40af" size={18} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search locations..."
          style={styles.input}
        />
        <TouchableOpacity style={[styles.chip, activeOnly && styles.chipActive]} onPress={() => setActiveOnly(!activeOnly)}>
          {activeOnly ? <CheckCircle2 color="#10b981" size={16} /> : <AlertCircle color="#6b7280" size={16} />}
          <Text style={styles.chipText}>{activeOnly ? 'Active' : 'All'}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.meta}>{item.code ?? '-'}</Text>
          </View>
        )}
        refreshing={manualRefreshing}
        onRefresh={() => refresh(true)}
        contentContainerStyle={{ paddingBottom: 16 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  name: { fontSize: 14, color: '#111827', fontWeight: '600' },
  meta: { fontSize: 12, color: '#6b7280' },
});
