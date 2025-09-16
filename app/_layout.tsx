import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { WarehouseProvider } from "@/providers/warehouse-provider";
import { ApiProvider } from "@/providers/api-provider";
import { ScanProvider } from "@/providers/scan-provider";
import DeviceModeGate from "@/components/DeviceModeGate";
import { trpc, trpcClient } from "@/lib/trpc";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ 
      headerBackTitle: "Back",

      headerStyle: {
        backgroundColor: '#1e40af',
      },
      headerTintColor: '#fff',
      headerTitleStyle: {
        fontWeight: 'bold',
        fontSize: 16,
      },
      headerTitleAlign: 'center',
    }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen 
        name="scan" 
        options={{ 
          title: "Scan Package",
          presentation: "modal",
          headerStyle: {
            backgroundColor: '#1e40af',
          },
          headerTitleStyle: {
            fontWeight: 'bold',
            fontSize: 16,
          },
    
        }} 
      />
      <Stack.Screen 
        name="find" 
        options={{ 
          title: "Find Package",
          presentation: "modal",
          headerStyle: {
            backgroundColor: '#1e40af',
          },
          headerTitleStyle: {
            fontWeight: 'bold',
            fontSize: 16,
          },
    
        }} 
      />
      <Stack.Screen 
        name="move-pallet" 
        options={{ 
          title: "Move Pallet",
          presentation: "modal",
          headerStyle: {
            backgroundColor: '#1e40af',
          },
          headerTitleStyle: {
            fontWeight: 'bold',
            fontSize: 16,
          },
    
        }} 
      />
      <Stack.Screen 
        name="pallet-label" 
        options={{ 
          title: "Pallet Label",
          presentation: "modal",
          headerStyle: {
            backgroundColor: '#1e40af',
          },
          headerTitleStyle: {
            fontWeight: 'bold',
            fontSize: 16,
          },
    
        }} 
      />
      <Stack.Screen 
        name="batch-scan" 
        options={{ 
          title: "Batch Scanning",
          presentation: "modal",
          headerStyle: {
            backgroundColor: '#1e40af',
          },
          headerTitleStyle: {
            fontWeight: 'bold',
            fontSize: 16,
          },
    
        }} 
      />
      <Stack.Screen 
        name="training-mode" 
        options={{ 
          title: "Training Mode",
          presentation: "modal",
          headerStyle: {
            backgroundColor: '#1e40af',
          },
          headerTitleStyle: {
            fontWeight: 'bold',
            fontSize: 16,
          },
    
        }} 
      />
      <Stack.Screen 
        name="error-correction" 
        options={{ 
          title: "Error Correction",
          presentation: "modal",
          headerStyle: {
            backgroundColor: '#1e40af',
          },
          headerTitleStyle: {
            fontWeight: 'bold',
            fontSize: 16,
          },
    
        }} 
      />
    </Stack>
  );
}

export default function RootLayout() {
  console.log('[RootLayout] mount');
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={styles.root}>
          <ApiProvider>
            <ScanProvider>
              <WarehouseProvider>
                <DeviceModeGate />
                <RootLayoutNav />
              </WarehouseProvider>
            </ScanProvider>
          </ApiProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});