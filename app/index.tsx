import { Text, View } from "react-native";
import TiledMap from "./components/map";

export default function Index() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <TiledMap />
    </View>
  );
}
