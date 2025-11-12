import { Text, View } from "react-native";
import Map from "./components/map";

export default function Index() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Map />
    </View>
  );
}
