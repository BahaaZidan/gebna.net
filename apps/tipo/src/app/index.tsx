import { UiComponents } from "@gebna/ui-components";
import { Text, View } from "react-native";

export function RootPage() {
	return (
		<View className="flex gap-2 bg-green-500 p-20">
			<Text className="font-mono">mono is cool</Text>
			<Text className="text-3xl">hoba</Text>
			<UiComponents />
		</View>
	);
}

export default RootPage;
