import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Search, Package, MapPin, Calendar, ChevronRight } from 'lucide-react-native';
import { useWarehouse } from '@/providers/warehouse-provider';

export default function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'tracking' | 'po' | 'pallet'>('tracking');
  const { searchPackages } = useWarehouse();
  
  const searchResults = searchPackages(searchQuery, searchType);

  const searchTypes = [
    { id: 'tracking', label: 'Tracking #' },
    { id: 'po', label: 'PO Number' },
    { id: 'pallet', label: 'Pallet Code' },
  ];

  return (
    <View style={styles.container}>
      {/* Search Header */}
      <View style={styles.searchHeader}>
        <View style={styles.searchInputContainer}>
          <Search color="#6b7280" size={20} />
          <TextInput
            style={styles.searchInput}
            placeholder={`Search by ${searchType}...`}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="characters"
            autoCorrect={false}
          />
        </View>
        
        <View style={styles.searchTypeContainer}>
          {searchTypes.map((type) => (
            <TouchableOpacity
              key={type.id}
              style={[
                styles.searchTypeButton,
                searchType === type.id && styles.searchTypeActive,
              ]}
              onPress={() => setSearchType(type.id as any)}
            >
              <Text style={[
                styles.searchTypeText,
                searchType === type.id && styles.searchTypeActiveText,
              ]}>
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Search Results */}
      <ScrollView style={styles.results}>
        {searchQuery === '' ? (
          <View style={styles.emptyState}>
            <Search color="#9ca3af" size={48} />
            <Text style={styles.emptyText}>Enter a search term</Text>
            <Text style={styles.emptySubtext}>
              Search by tracking number, PO, or pallet code
            </Text>
          </View>
        ) : searchResults.length === 0 ? (
          <View style={styles.emptyState}>
            <Package color="#9ca3af" size={48} />
            <Text style={styles.emptyText}>No results found</Text>
            <Text style={styles.emptySubtext}>
              Try a different search term or type
            </Text>
          </View>
        ) : (
          searchResults.map((result) => (
            <TouchableOpacity key={result.id} style={styles.resultCard}>
              <View style={styles.resultIcon}>
                <Package color="#1e40af" size={24} />
              </View>
              
              <View style={styles.resultContent}>
                <Text style={styles.resultTracking}>{result.tracking}</Text>
                <View style={styles.resultDetails}>
                  <View style={styles.resultDetail}>
                    <Text style={styles.resultLabel}>PO:</Text>
                    <Text style={styles.resultValue}>{result.poNumber}</Text>
                  </View>
                  <View style={styles.resultDetail}>
                    <Text style={styles.resultLabel}>Pallet:</Text>
                    <Text style={styles.resultValue}>{result.palletCode}</Text>
                  </View>
                </View>
                
                {result.location && (
                  <View style={styles.locationInfo}>
                    <MapPin color="#6b7280" size={14} />
                    <Text style={styles.locationText}>{result.location}</Text>
                  </View>
                )}
                
                <View style={styles.timestampInfo}>
                  <Calendar color="#9ca3af" size={12} />
                  <Text style={styles.timestampText}>
                    Scanned: {result.timestamp}
                  </Text>
                </View>
              </View>
              
              <ChevronRight color="#9ca3af" size={20} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  searchHeader: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 8,
    color: '#111827',
  },
  searchTypeContainer: {
    flexDirection: 'row',
    marginHorizontal: -4,
  },
  searchTypeButton: {
    flex: 1,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  searchTypeActive: {
    backgroundColor: '#1e40af',
  },
  searchTypeText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
  },
  searchTypeActiveText: {
    color: '#fff',
  },
  results: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6b7280',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 4,
    textAlign: 'center',
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
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
  resultIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  resultContent: {
    flex: 1,
  },
  resultTracking: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  resultDetails: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  resultDetail: {
    flexDirection: 'row',
    marginRight: 16,
  },
  resultLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginRight: 4,
  },
  resultValue: {
    fontSize: 12,
    fontWeight: '500',
    color: '#111827',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 4,
  },
  timestampInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timestampText: {
    fontSize: 11,
    color: '#9ca3af',
    marginLeft: 4,
  },
});