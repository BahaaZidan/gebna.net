import { View, Text } from 'react-native';
import { useFragment } from 'react-relay';
import type { ViewerGreetingFragment$key } from './__generated__/ViewerGreetingFragment.graphql';
import fragmentNode from './__generated__/ViewerGreetingFragment.graphql';
import { Button } from '@repo/ui-components';

export type ViewerGreetingProps = {
  fragmentRef: ViewerGreetingFragment$key;
  onPress?: () => void;
};

export const ViewerGreeting = ({ fragmentRef, onPress }: ViewerGreetingProps) => {
  const data = useFragment(fragmentNode, fragmentRef);

  if (!data) {
    return null;
  }

  return (
    <View className="gap-2 rounded-2xl bg-slate-800 p-4">
      <Text className="text-slate-50 text-lg font-semibold">Hello, {data.name}</Text>
      <Text className="text-slate-200 text-sm">@{data.username}</Text>
      <Button label="Say hi" onPress={onPress} />
    </View>
  );
};
