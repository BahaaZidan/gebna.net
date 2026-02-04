/* eslint-disable jsx-a11y/accessible-emoji */
import "../../../../global.css";

import { UiComponents } from "@gebna/ui-components";
import { Text, View } from "react-native";

export const App = () => {
	return (
		<View className="flex gap-2 bg-green-500 p-20">
			<Text className="font-mono">mono is cool</Text>
			<Text className="text-3xl">hoba</Text>
			<UiComponents />
		</View>
	);
};

export default App;
