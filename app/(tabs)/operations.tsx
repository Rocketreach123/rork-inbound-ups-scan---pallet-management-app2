import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Package, MapPin, Clock, PlusCircle, Truck } from 'lucide-react-native';
import { useWarehouse } from '@/providers/warehouse-provider';
import { router } from 'expo-router';

export default function OperationsScreen() {
  const { pallets, locations } = useWarehouse();
  const [activeTab, setActiveTab] = useState<'pallets' | 'locations'>('pallets');

  const tabs = [
    { id: 'pallets', label: 'Active License Plates' },
    { id: 'locations', label: 'Locations' },
  ];

  return (
    <View style={styles.container}>
      {/* Tab Switcher */}
      <View style={styles.tabContainer}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tab,
              activeTab === tab.id && styles.activeTab,
            ]}
            onPress={() => setActiveTab(tab.id as 'pallets' | 'locations')}
          >
            <Text style={[
              styles.tabText,
              activeTab === tab.id && styles.activeTabText,
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content}>
        {activeTab === 'pallets' && (
          <>
            <TouchableOpacity
              style={styles.createPalletButton}
              onPress={() => router.push('/pallet-label' as any)}
              testID="create-pallet"
            >
              <PlusCircle color="#fff" size={20} />
              <Text style={styles.createPalletText}>Create License Plate Label</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.createPalletButton, styles.upsButton]}
              onPress={() => router.push('/ups-tracker' as any)}
              testID="ups-tracker"
            >
              <Truck color="#fff" size={20} />
              <Text style={styles.createPalletText}>UPS Package Tracker</Text>
            </TouchableOpacity>
          </>
        )}
        {activeTab === 'pallets' ? (
          <View style={styles.listContainer}>
            {pallets.map((pallet) => (
              <View key={pallet.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.palletIcon}>
                    <Package color="#1e40af" size={24} />
                  </View>
                  <View style={styles.cardHeaderContent}>
                    <Text style={styles.palletCode}>LP {pallet.palletCode.replace(/^LP/i, '')}</Text>
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusText}>{pallet.state}</Text>
                    </View>
                  </View>
                </View>
                
                <View style={styles.cardDetails}>
                  <View style={styles.detailRow}>
                    <Clock color="#6b7280" size={16} />
                    <Text style={styles.detailText}>Due: {pallet.workDate}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <MapPin color="#6b7280" size={16} />
                    <Text style={styles.detailText}>
                      {pallet.currentLocation || 'Not assigned'}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Package color="#6b7280" size={16} />
                    <Text style={styles.detailText}>
                      {pallet.packageCount} packages • {pallet.department}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.actionButton}>
                    <Text style={styles.actionButtonText}>View Details</Text>
                  </TouchableOpacity>
                  {pallet.state === 'OPEN' && (
                    <TouchableOpacity style={[styles.actionButton, styles.closeButton]}>
                      <Text style={styles.closeButtonText}>Close License Plate</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.listContainer}>
            {locations.map((location) => (
              <View key={location.id} style={styles.locationCard}>
                <View style={styles.locationHeader}>
                  <MapPin color="#1e40af" size={20} />
                  <Text style={styles.locationCode}>{location.code}</Text>
                </View>
                <View style={styles.locationGrid}>
                  <View style={styles.locationItem}>
                    <Text style={styles.locationLabel}>Zone</Text>
                    <Text style={styles.locationValue}>{location.zone}</Text>
                  </View>
                  <View style={styles.locationItem}>
                    <Text style={styles.locationLabel}>Aisle</Text>
                    <Text style={styles.locationValue}>{location.aisle}</Text>
                  </View>
                  <View style={styles.locationItem}>
                    <Text style={styles.locationLabel}>Bay</Text>
                    <Text style={styles.locationValue}>{location.bay}</Text>
                  </View>
                  <View style={styles.locationItem}>
                    <Text style={styles.locationLabel}>Level</Text>
                    <Text style={styles.locationValue}>{location.level}</Text>
                  </View>
                </View>
                {location.currentPallet && (
                  <View style={styles.locationPallet}>
                    <Package color="#6b7280" size={14} />
                    <Text style={styles.locationPalletText}>
                      Current LP: {location.currentPallet}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#1e40af',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeTabText: {
    color: '#1e40af',
  },
  content: {
    flex: 1,
  },
  createPalletButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#1e40af',
  },
  createPalletText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  listContainer: {
    padding: 16,
  },
  card: {
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
  cardHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  palletIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardHeaderContent: {
    flex: 1,
  },
  palletCode: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  statusBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
  },
  cardDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailText: {
    fontSize: 13,
    color: '#6b7280',
    marginLeft: 8,
  },
  cardActions: {
    flexDirection: 'row',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#eff6ff',
    marginRight: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1e40af',
  },
  closeButton: {
    backgroundColor: '#fef2f2',
  },
  closeButtonText: {
    color: '#dc2626',
  },
  locationCard: {
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
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationCode: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
  },
  locationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  locationItem: {
    width: '25%',
    padding: 4,
  },
  locationLabel: {
    fontSize: 11,
    color: '#9ca3af',
    marginBottom: 2,
  },
  locationValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  locationPallet: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  locationPalletText: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 6,
  },
  upsButton: {
    backgroundColor: '#8B4513',
  },
});