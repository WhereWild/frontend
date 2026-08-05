    if (ENABLE_OFFLINE_FALLBACK) {
      // Natural Earth is public domain and doesn't legally require
      // attribution, but GeoNames (used for the offline populated-places
      // labels) is CC-BY — this is a real license requirement, not courtesy.
      map.addControl(new maplibregl.AttributionControl({
        customAttribution: [
          '<a href="https://www.naturalearthdata.com/" target="_blank">Natural Earth</a>, '
          + '<a href="https://www.geonames.org/" target="_blank">GeoNames</a>',
        ],
      }));
    }
