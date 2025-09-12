import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Search, Package, MapPin, Navigation, ChevronRight } from 'lucide-react-native';
import { router } from 'expo-router';
import { useWarehouse } from '@/providers/warehouse-provider';

export default function FindScreen() {
  const [searchValue, setSearchValue] = useState('');
  const [searchResult, setSearchResult] = useState<any>(null);
  const { findPackage } = useWarehouse();

  const handleSearch = async () => {
    if (!searchValue.trim()) return;
    
    const result = await findPackage(searchValue);
    setSearchResult(result);
  };

  const renderRouteSteps = () => {
    if (!searchResult?.routeHint) return null;
    
    return searchResult.routeHint.map((step: string, index: number) => (
      <View key={index} style={styles.routeStep}>
        <View style={styles.stepNumber}>
          <Text style={styles.stepNumberText}>{index + 1}</Text>
        </View>
        <Text style={styles.stepText}>{step}</Text>
        <ChevronRight color="#9ca3af" size={20} />
      </View>
    ));
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Search color="#6b7280" size={20} />
          <TextInput
            style={styles.searchInput}
            placeholder="Enter tracking, PO, or order number..."
            value={searchValue}
            onChangeText={setSearchValue}
            autoCapitalize="characters"
            autoCorrect={false}
            onSubmitEditing={handleSearch}
          />
        </View>
        
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      </View>

      {searchResult && (
        <View style={styles.resultSection}>
          {searchResult.found ? (
            <>
              <View style={styles.resultCard}>
                <View style={styles.resultHeader}>
                  <Package color="#10b981" size={32} />
                  <Text style={styles.resultTitle}>Package Found</Text>
                </View>

                <View style={styles.palletInfo}>
                  <Text style={styles.palletLabel}>Current Pallet</Text>
                  <Text style={styles.palletCode}>
                    {searchResult.pallet.palletCode}
                  </Text>
                </View>

                <View style={styles.locationCard}>
                  <View style={styles.locationHeader}>
                    <MapPin color="#1e40af" size={24} />
                    <Text style={styles.locationTitle}>Current Location</Text>
                  </View>
                  
                  <View style={styles.locationGrid}>
                    <View style={styles.locationItem}>
                      <Text style={styles.locationLabel}>Zone</Text>
                      <Text style={styles.locationValue}>
                        {searchResult.location.zone}
                      </Text>
                    </View>
                    <View style={styles.locationItem}>
                      <Text style={styles.locationLabel}>Aisle</Text>
                      <Text style={styles.locationValue}>
                        {searchResult.location.aisle}
                      </Text>
                    </View>
                    <View style={styles.locationItem}>
                      <Text style={styles.locationLabel}>Bay</Text>
                      <Text style={styles.locationValue}>
                        {searchResult.location.bay}
                      </Text>
                    </View>
                    <View style={styles.locationItem}>
                      <Text style={styles.locationLabel}>Level</Text>
                      <Text style={styles.locationValue}>
                        {searchResult.location.level}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.lastSeenInfo}>
                  <Text style={styles.lastSeenText}>
                    Last seen: {searchResult.lastSeen}
                  </Text>
                </View>
              </View>

              <View style={styles.navigationCard}>
                <View style={styles.navigationHeader}>
                  <Navigation color="#1e40af" size={24} />
                  <Text style={styles.navigationTitle}>Navigation Steps</Text>
                </View>
                
                <View style={styles.routeSteps}>
                  {renderRouteSteps()}
                </View>

                <TouchableOpacity style={styles.navigateButton}>
                  <Navigation color="#fff" size={20} />
                  <Text style={styles.navigateButtonText}>Start Navigation</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.notFoundCard}>
              <Package color="#dc2626" size={48} />
              <Text style={styles.notFoundTitle}>Package Not Found</Text>
              <Text style={styles.notFoundText}>
                {searchResult.reason === 'NEVER_SCANNED' 
                  ? 'This package has not been scanned yet'
                  : 'No package found with this identifier'}
              </Text>
              <TouchableOpacity 
                style={styles.scanButton}
                onPress={() => router.push('/scan' as any)}
              >
                <Text style={styles.scanButtonText}>Scan New Package</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  searchSection: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  searchContainer: {
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
  searchButton: {
    backgroundColor: '#1e40af',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  searchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultSection: {
    padding: 16,
  },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
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
    marginBottom: 20,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginTop: 8,
  },
  palletInfo: {
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  palletLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  palletCode: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e40af',
  },
  locationCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
  },
  locationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  locationItem: {
    width: '50%',
    paddingVertical: 8,
  },
  locationLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  locationValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  lastSeenInfo: {
    alignItems: 'center',
  },
  lastSeenText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  navigationCard: {
    backgroundColor: '#fff',
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
  navigationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  navigationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
  },
  routeSteps: {
    marginBottom: 16,
  },
  routeStep: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e40af',
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },
  navigateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e40af',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  navigateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  notFoundCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
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
  notFoundTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#dc2626',
    marginTop: 16,
    marginBottom: 8,
  },
  notFoundText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  scanButton: {
    backgroundColor: '#1e40af',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});