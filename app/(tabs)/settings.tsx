import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Switch, Platform, Modal } from 'react-native';
import { User, Printer, MapPin, Bell, Shield, ChevronRight, LogOut, Cable, Smartphone, Radio, Bluetooth, Scan } from 'lucide-react-native';
import { useWarehouse } from '@/providers/warehouse-provider';
import ApiConfigSheet from '@/components/ApiConfigSheet';
import { useApi } from '@/providers/api-provider';
import { useScan, DeviceMode } from '@/providers/scan-provider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const { settings, updateSettings } = useWarehouse();
  const { isEnabled: apiEnabled } = useApi();
  const [apiVisible, setApiVisible] = useState<boolean>(false);
  const { deviceMode, setDeviceMode, flags } = useScan();
  const insets = useSafeAreaInsets();

  const settingsSections = [
    {
      title: 'User',
      items: [
        { 
          icon: User, 
          label: 'Profile', 
          value: 'John Doe - Receiver',
          action: 'navigate' 
        },
        { 
          icon: Shield, 
          label: 'Permissions', 
          value: 'Receiver Role',
          action: 'navigate' 
        },
      ],
    },
    {
      title: 'Operations',
      items: [
        { 
          icon: Printer, 
          label: 'Default Printer', 
          value: settings.defaultPrinter || 'Not Set',
          action: 'navigate' 
        },
        { 
          icon: MapPin, 
          label: 'Default Zone', 
          value: settings.defaultZone || 'Zone 1',
          action: 'navigate' 
        },
        { 
          icon: Cable,
          label: 'API Connection',
          value: apiEnabled ? 'Connected' : 'Not configured',
          action: 'modal',
          onPress: () => setApiVisible(true),
        },
      ],
    },
    {
      title: 'Devices',
      items: [
        {
          icon: Smartphone,
          label: 'Device Mode',
          value: deviceMode,
          action: 'custom',
          onPress: undefined,
          render: () => (
            <View style={styles.deviceGrid}>
              {([
                {
                  label: 'Skorpio X5',
                  subtitle: 'Built-in hardware trigger',
                  value: 'skorpio-x5' as DeviceMode,
                  Icon: Radio,
                },
                {
                  label: 'Mobile Camera',
                  subtitle: 'Phone/iPad camera scanning',
                  value: 'mobile-camera' as DeviceMode,
                  Icon: Scan,
                },
                {
                  label: 'Bluetooth Scanner',
                  subtitle: 'Keystroke wedge input',
                  value: 'external-wedge' as DeviceMode,
                  Icon: Bluetooth,
                },
              ] as { label: string; subtitle: string; value: DeviceMode; Icon: React.ComponentType<{ color?: string; size?: number }> }[]).map((opt) => {
                const selected = deviceMode === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.deviceCard, selected && styles.deviceCardSelected]}
                    onPress={async () => { console.log('Selecting device mode', opt.value); await setDeviceMode(opt.value); }}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    testID={`device-mode-${opt.value}`}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.deviceIconWrap, selected && styles.deviceIconWrapSelected]}>
                      <opt.Icon color={selected ? '#1e40af' : '#374151'} size={24} />
                    </View>
                    <View style={styles.deviceTextWrap}>
                      <Text style={[styles.deviceTitle, selected && styles.deviceTitleSelected]}>{opt.label}</Text>
                      <Text style={styles.deviceSubtitle}>{opt.subtitle}</Text>
                    </View>
                    {selected && (
                      <View style={styles.deviceBadge}>
                        <Text style={styles.deviceBadgeText}>Selected</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )
        },
        {
          icon: Radio,
          label: 'Prevent Camera Use',
          value: flags.scan.device_mode === 'skorpio-x5',
          action: 'toggle',
          key: 'preventCamera',
          disabled: true,
        },
      ],
    },
    {
      title: 'Preferences',
      items: [
        { 
          icon: Bell, 
          label: 'Notifications', 
          value: settings.notifications,
          action: 'toggle',
          key: 'notifications'
        },
        { 
          icon: Bell, 
          label: 'Sound Effects', 
          value: settings.soundEffects,
          action: 'toggle',
          key: 'soundEffects'
        },
      ],
    },
  ];

  const handleToggle = (key: string, value: boolean) => {
    updateSettings({ [key]: value } as any);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingTop: insets.top, paddingBottom: 24 }}>
      {settingsSections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.sectionContent}>
            {section.items.map((item: any, itemIndex: number) => (
              <TouchableOpacity
                key={item.label}
                style={[
                  styles.settingItem,
                  itemIndex === section.items.length - 1 && styles.lastItem,
                ]}
                disabled={item.action === 'toggle'}
                onPress={item.onPress}
                testID={`settings-item-${item.label.replace(/\s+/g, '-').toLowerCase()}`}
              >
                <View style={styles.settingIcon}>
                  <item.icon color="#6b7280" size={20} />
                </View>
                <View style={styles.settingContent}>
                  <Text style={styles.settingLabel}>{item.label}</Text>
                  {item.action !== 'toggle' && (
                    <Text style={styles.settingValue}>{String(item.value)}</Text>
                  )}
                </View>
                {item.action === 'toggle' ? (
                  <Switch
                    value={item.value as boolean}
                    onValueChange={(value) => handleToggle(item.key, value)}
                    trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
                    thumbColor={item.value ? '#1e40af' : '#f3f4f6'}
                    disabled={item.disabled}
                  />
                ) : item.action === 'custom' && item.render ? (
                  item.render()
                ) : (
                  <ChevronRight color="#9ca3af" size={20} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.sectionContent}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Version</Text>
            <Text style={styles.infoValue}>1.0.0</Text>
          </View>
          <View style={[styles.infoItem, styles.lastItem]}>
            <Text style={styles.infoLabel}>Environment</Text>
            <Text style={styles.infoValue}>Production</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.logoutButton}>
        <LogOut color="#dc2626" size={20} />
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>

      <Modal visible={apiVisible} transparent animationType="slide" onRequestClose={() => setApiVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ApiConfigSheet />
            <TouchableOpacity style={[styles.button, styles.primary, { marginTop: 12 }]} onPress={() => setApiVisible(false)}>
              <Text style={styles.buttonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  sectionContent: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  lastItem: {
    borderBottomWidth: 0,
  },
  settingIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  settingValue: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  infoLabel: {
    fontSize: 15,
    color: '#111827',
  },
  infoValue: {
    fontSize: 15,
    color: '#6b7280',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 32,
    paddingVertical: 12,
    borderRadius: 12,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#dc2626',
    marginLeft: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  button: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: '#1e40af' },
  buttonText: { color: '#fff', fontWeight: '700' },
  deviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingVertical: 8,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 4,
  },
  deviceCardSelected: {
    backgroundColor: '#eef2ff',
    borderColor: '#1e40af',
  },
  deviceIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#eef2ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  deviceIconWrapSelected: {
    backgroundColor: '#dbeafe',
    borderColor: '#1e40af',
  },
  deviceTextWrap: {
    flex: 1,
  },
  deviceTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  deviceTitleSelected: {
    color: '#1e40af',
  },
  deviceSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  deviceBadge: {
    backgroundColor: '#1e40af',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  deviceBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
});
