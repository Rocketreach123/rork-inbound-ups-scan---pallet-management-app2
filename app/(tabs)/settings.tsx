import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Switch, Platform, Modal } from 'react-native';
import { User, Printer, MapPin, Bell, Shield, ChevronRight, LogOut, Cable, Smartphone, Radio } from 'lucide-react-native';
import { useWarehouse } from '@/providers/warehouse-provider';
import ApiConfigSheet from '@/components/ApiConfigSheet';
import { useApi } from '@/providers/api-provider';
import { useScan, DeviceMode } from '@/providers/scan-provider';

export default function SettingsScreen() {
  const { settings, updateSettings } = useWarehouse();
  const { isEnabled: apiEnabled } = useApi();
  const [apiVisible, setApiVisible] = useState<boolean>(false);
  const { deviceMode, setDeviceMode, flags } = useScan();

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
            <View style={{ gap: 8 }}>
              {[
                { label: 'Skorpio X5 (Hardware Scanner)', value: 'skorpio-x5' as DeviceMode },
                { label: 'Mobile (Phone/iPad Camera Scanner)', value: 'mobile-camera' as DeviceMode },
                { label: 'External/Bluetooth Scanner (Keystroke Wedge)', value: 'external-wedge' as DeviceMode },
              ].map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={styles.radioRow}
                  onPress={async () => { await setDeviceMode(opt.value); }}
                  testID={`device-mode-${opt.value}`}
                >
                  <View style={[styles.radioOuter, deviceMode === opt.value && styles.radioOuterActive]}>
                    {deviceMode === opt.value && <View style={styles.radioInner} />}
                  </View>
                  <Text style={styles.radioLabel}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
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
    <ScrollView style={styles.container}>
      {settingsSections.map((section, sectionIndex) => (
        <View key={sectionIndex} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.sectionContent}>
            {section.items.map((item: any, itemIndex: number) => (
              <TouchableOpacity
                key={itemIndex}
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
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#9ca3af',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: {
    borderColor: '#1e40af',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1e40af',
  },
  radioLabel: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    flexWrap: 'wrap',
  },
});
