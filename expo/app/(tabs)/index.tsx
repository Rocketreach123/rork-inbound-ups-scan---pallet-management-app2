import React from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { router } from 'expo-router';
import { Package, Search, TruckIcon, MapPin, BarChart3, Clock, AlertTriangle } from 'lucide-react-native';
import { useWarehouse } from '@/providers/warehouse-provider';

export default function DashboardScreen() {
  const { stats, recentScans } = useWarehouse();

  const quickActions = [
    { 
      id: 'scan', 
      title: 'Single Scan', 
      icon: Package, 
      color: '#10b981',
      route: '/scan' 
    },
    { 
      id: 'batch-scan', 
      title: 'Batch Scan', 
      icon: BarChart3, 
      color: '#059669',
      route: '/batch-scan' 
    },
    { 
      id: 'find', 
      title: 'Find Package', 
      icon: Search, 
      color: '#3b82f6',
      route: '/find' 
    },
    { 
      id: 'move', 
      title: 'Move Pallet', 
      icon: TruckIcon, 
      color: '#f59e0b',
      route: '/move-pallet' 
    },
    { 
      id: 'training', 
      title: 'Training Mode', 
      icon: Clock, 
      color: '#7c3aed',
      route: '/training-mode' 
    },
    { 
      id: 'errors', 
      title: 'Error Correction', 
      icon: AlertTriangle, 
      color: '#dc2626',
      route: '/error-correction' 
    },
    { 
      id: 'locations', 
      title: 'Locations', 
      icon: MapPin, 
      color: '#8b5cf6',
      route: '/operations' 
    },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <Package color="#10b981" size={24} />
          </View>
          <Text style={styles.statValue}>{stats.todayScans}</Text>
          <Text style={styles.statLabel}>Today's Scans</Text>
        </View>
        
        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <BarChart3 color="#3b82f6" size={24} />
          </View>
          <Text style={styles.statValue}>{stats.activePallets}</Text>
          <Text style={styles.statLabel}>Active Pallets</Text>
        </View>
        
        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <Clock color="#f59e0b" size={24} />
          </View>
          <Text style={styles.statValue}>{stats.pendingPackages}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsGrid}>
        {quickActions.map((action) => (
          <TouchableOpacity
            key={action.id}
            style={styles.actionCard}
            onPress={() => router.push(action.route as any)}
            testID={`action-${action.id}`}
          >
            <View style={[styles.actionIcon, { backgroundColor: `${action.color}15` }]}>
              <action.icon color={action.color} size={28} />
            </View>
            <Text style={styles.actionTitle}>{action.title}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Recent Activity */}
      <Text style={styles.sectionTitle}>Recent Activity</Text>
      <View style={styles.activityContainer}>
        {recentScans.length === 0 ? (
          <View style={styles.emptyState}>
            <Package color="#9ca3af" size={48} />
            <Text style={styles.emptyText}>No recent scans</Text>
            <Text style={styles.emptySubtext}>Start scanning packages to see activity</Text>
          </View>
        ) : (
          recentScans.map((scan) => (
            <View key={scan.id} style={styles.activityItem}>
              <View style={styles.activityIcon}>
                <Package color="#6b7280" size={20} />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityTracking}>{scan.tracking}</Text>
                <Text style={styles.activityDetails}>
                  PO: {scan.poNumber} • Pallet: {scan.palletCode}
                </Text>
                <Text style={styles.activityTime}>{scan.timestamp}</Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  content: {
    padding: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
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
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
    marginBottom: 24,
  },
  actionCard: {
    width: '50%',
    padding: 8,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    alignSelf: 'center',
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    textAlign: 'center',
  },
  activityContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
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
  activityItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTracking: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  activityDetails: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 11,
    color: '#9ca3af',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
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
  },
});