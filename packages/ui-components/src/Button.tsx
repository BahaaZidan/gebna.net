import { Pressable, Text, View } from 'react-native';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
};

export const Button = ({ label, onPress }: ButtonProps) => {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="px-4 py-2 rounded-xl bg-emerald-600 active:bg-emerald-700"
    >
      <View className="flex-row items-center justify-center">
        <Text className="text-white font-semibold text-base">{label}</Text>
      </View>
    </Pressable>
  );
};
