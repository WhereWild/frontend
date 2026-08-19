# Welcome to WhereWild!

WhereWild is a website and mobile application that combines *occurrence and environmental data* to generate a field guide and in-depth analytics on the habitat of over 170,000 species.

WhereWild was created for a Senior Capstone project by Computer Science students Lucas Pearce, Kelly Wu, Luke Allen, and Draeden Jensen at the University of Utah. This page gives a brief overview of the project and its team members.

# Acknowledgements

We deeply appreciate all of the different sources of data we used to create this project. Learn more on our [acknowledgements page](/acknowledgements).

# What does WhereWild do and how does it work?

At a high level, WhereWild works by combining occurrence data with environmental data.

## Occurrence and environmental data: what do those mean?

### Occurrence data

Occurrence data is data that describes the *where* and *when* a given species has been found. A single data point is often referred to as an *observation*, which includes the latitude/longitude and often timestamp of the observation, and optionally extra annotations. For example, if I saw [a cactus](https://www.inaturalist.org/observations/345543375) on a hike, I could take a picture and upload it to iNaturalist as a single data point. We get our occurrence data from [iNaturalist](https://www.inaturalist.org/)/[GBIF](https://www.gbif.org/) — view our citations for more.

Occurrence data is just a very large list of these data points, organized by taxonomy. The current data snapshot includes ~65 million [Research Grade](https://help.inaturalist.org/en/support/solutions/articles/151000169936-what-is-the-data-quality-assessment-and-how-do-observations-qualify-to-become-research-grade-) observations.

Occurrence data is a great way to understand the distribution of a species. For example, we can view a map of all observations of [Opuntia fragilis](https://wherewild.net/species/6SRLS/opuntia-fragilis?variable=bio1#species-occurrence-map), and observe a wide range across western North America. However, occurrence data alone struggles to explain the *actual habitat and climate* of these locations, and *why* a species might have the range it does.

<!-- image: opuntia -->

### Environmental data

Environmental data is what tells us about what the actual habitat and climate of a location is. Take Salt Lake City, for example. It's a high elevation city right next to the even higher elevation Wasatch Range. It's at the edge of the Great Basin, and is generally quite dry compared to the rest of the US; however, it (typically!) sees large amounts of snow in the winter. Due to these factors, the temperature can vary quite a lot, with hot summers and cold winters.

Altogether, these factors constrain the natural wildlife that can be observed around the area. Wildlife at lower elevations must be better adapted to hotter and drier conditions, while those at higher elevations must deal with steeper slopes and harsher winters. The valley is more of a scrubland while the mountains are more forested.

Our environmental data is stored in the form of *rasters*, which is just a fancy way of saying the Earth is divided up into "cells" where each pixel covers some span of land and has some value. For example, here is a picture of part of the US for landcover data, classifying each area as to whether it's a forest, grassland, city, etc:

<!-- image: landcover -->

### Putting it all together

Combining the two, something amazing happens! We can get an idea of what the actual conditions are like at each location a given species has been observed. We can even use [historical weather data](https://open-meteo.com/en/docs/historical-weather-api) to reconstruct what the *recent weather was at the time of observation*, to reconstruct patterns in the weather conditions animals prefer to be active in, or plants prefer to flower in.

<!-- image: density -->
