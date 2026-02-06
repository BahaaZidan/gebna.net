import { View } from 'react-native';
import { createFileRoute } from '@tanstack/react-router';
import { useLazyLoadQuery } from 'react-relay';
import { ViewerGreeting } from '@repo/data-components';
import queryNode from '../__generated__/DesktopViewerGreetingQuery.graphql.js';
import type { DesktopViewerGreetingQuery } from '../__generated__/DesktopViewerGreetingQuery.graphql.ts';

export const Route = createFileRoute('/')({
  component: IndexRoute,
});

function IndexRoute() {
  const data = useLazyLoadQuery<DesktopViewerGreetingQuery>(queryNode, {});

  if (!data.viewer) {
    return null;
  }

  return (
    <View className="gap-4">
      <ViewerGreeting
        fragmentRef={data.viewer}
        onPress={() => {
          console.log('Shared button pressed from desktop');
        }}
      />
    </View>
  );
}
