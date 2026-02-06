import './global.css';

import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, ScrollView, View } from 'react-native';
import { RelayEnvironmentProvider, useLazyLoadQuery } from 'react-relay';
import { ViewerGreeting, createRelayEnvironment } from '@repo/data-components';
import queryNode from './__generated__/AppViewerGreetingQuery.graphql.js';
import type { AppViewerGreetingQuery } from './__generated__/AppViewerGreetingQuery.graphql.ts';

const environment = createRelayEnvironment();

const Screen = () => {
  const data = useLazyLoadQuery<AppViewerGreetingQuery>(queryNode, {});

  if (!data.viewer) {
    return null;
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-950">
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        <View className="gap-4">
          <ViewerGreeting
            fragmentRef={data.viewer}
            onPress={() => {
              console.log('Shared button pressed from mobile');
            }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default function App() {
  return (
    <RelayEnvironmentProvider environment={environment}>
      <Screen />
    </RelayEnvironmentProvider>
  );
}
