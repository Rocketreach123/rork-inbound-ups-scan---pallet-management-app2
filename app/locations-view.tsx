import React from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import LocationsView from '@/ui/LocationsView';

export default function LocationsViewScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <LocationsView />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});