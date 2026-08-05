
    // ---- offline place-name labels, ported from SpeciesOccurrenceMap.html's
    // registerLabelDataset/updateLabelDeclutter. Same source data (Natural
    // Earth parks/airports/ports/elevation points, plus GeoNames populated
    // places), but decluttering is NOT hand-rolled here the way it is in the
    // Leaflet template — MapLibre's symbol renderer already does viewport
    // culling and priority-based collision avoidance natively (and, unlike a
    // Leaflet DOM marker, a symbol layer is globe-occlusion-aware, so labels
    // on the far side of the globe are correctly hidden). Re-implementing the
    // Leaflet template's spatial-grid + greedy-acceptance algorithm on top of
    // that would just be fighting the renderer, so this instead expresses the
    // exact same per-feature z priority as `symbol-sort-key` (lower z = more
    // important = wins collisions, matching the Leaflet template's z
    // convention) and lets MapLibre do the placement work.
    if (ENABLE_OFFLINE_FALLBACK) {
      function toPlaceLabelFeature(name, lon, lat, z, weight) {
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lon, lat] },
          properties: { name: name, z: z != null ? z : 5, weight: weight },
        };
      }

      function featuresFromLabelGeoJson(geojson, weight) {
        return (geojson.features || []).reduce(function(acc, f) {
          var name = f.properties && f.properties.name;
          if (!name || !f.geometry || !f.geometry.coordinates) { return acc; }
          var z = f.properties && f.properties.z;
          acc.push(toPlaceLabelFeature(name, f.geometry.coordinates[0], f.geometry.coordinates[1], z, weight));
          return acc;
        }, []);
      }

      function featuresFromCompactRows(rows, weight) {
        return rows.reduce(function(acc, row) {
          var lon = row[0], lat = row[1], name = row[2], z = row[3];
          if (!name) { return acc; }
          acc.push(toPlaceLabelFeature(name, lon, lat, z, weight));
          return acc;
        }, []);
      }

      var PLACE_LABELS_GEOJSON = {
        type: 'FeatureCollection',
        features: []
          .concat(featuresFromLabelGeoJson(PARKS_GEOJSON, 'regular'))
          .concat(featuresFromLabelGeoJson(AIRPORTS_GEOJSON, 'regular'))
          .concat(featuresFromLabelGeoJson(PORTS_GEOJSON, 'regular'))
          .concat(featuresFromLabelGeoJson(ELEVATION_POINTS_GEOJSON, 'regular'))
          .concat(featuresFromCompactRows(GEONAMES_PLACES, 'bold')),
      };
    }
