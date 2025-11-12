import React, { useCallback } from "react";
import { GoogleMap, LoadScript, Rectangle } from "@react-google-maps/api";

const containerStyle = {
    width: "100%",
    height: "100vh",
};

const center = {
    lat: 40.611628,
    lng: -111.960159,
};

const API_KEY = "AIzaSyB1cyq4UtDTME4Dyg7GF5h7KtQcU3q5kYM";

// Hard-coded 4 small squares with random data as an example
const tileData = [
    { north: 40.61, south: 40.63, east: -111.96, west: -111.99, value: 0.0},
    { north: 40.63, south: 40.65, east: -111.96, west: -111.99, value: 0.25},
    { north: 40.61, south: 40.63, east: -111.99, west: -112.02, value: 0.5},
    { north: 40.63, south: 40.65, east: -111.99, west: -112.02, value: 0.75},
];


// Simple function to convert data to color
const valueToColor = (v: number) => {
  const r = Math.round(255 * v);
  const g = Math.round(255 * (1 - v));
  return `rgba(${r}, ${g}, 0, 0.4)`; // semi-transparent
};

const TiledMap: React.FC = () => {
  return (
    <LoadScript googleMapsApiKey={API_KEY}>
        <GoogleMap
            mapContainerStyle={containerStyle}
            center={center}
            zoom={10}
        >
            {tileData.map((tile, i) => (
                <Rectangle
                    key={i}
                    bounds={{
                        north: tile.north,
                        south: tile.south,
                        east: tile.east,
                        west: tile.west,
                    }}
                    options={{
                        fillColor: valueToColor(tile.value),
                        fillOpacity: 1.0,
                        strokeWeight: 0,
                    }}
                />
            ))}
        </GoogleMap>
    </LoadScript>
  );
};

export default TiledMap;