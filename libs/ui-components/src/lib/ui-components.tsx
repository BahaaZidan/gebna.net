import React from "react";
import { Text, View } from "react-native";

/* eslint-disable-next-line */
export interface UiComponentsProps {}

export function UiComponents(props: UiComponentsProps) {
	return (
		<View>
			<Text>Welcome to ui-components!</Text>
			<Text className="text-9xl bg-amber-300">WAW!</Text>
		</View>
	);
}

export default UiComponents;
