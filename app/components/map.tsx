//API key: AIzaSyB1cyq4UtDTME4Dyg7GF5h7KtQcU3q5kYM
import React from "react";
import { GoogleMap, LoadScript, Marker } from "@react-google-maps/api";

const containerStyle = {
  width: "100%",
  height: "100vh",
};

const center = {
  lat: 40.611628,
  lng: -111.960159,
};

const Map: React.FC = () => {
  return (
    <LoadScript googleMapsApiKey="AIzaSyB1cyq4UtDTME4Dyg7GF5h7KtQcU3q5kYM">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={10}
      >
      </GoogleMap>
    </LoadScript>
  );
};

export default Map;