// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  ContentImage,
  PageScrollContainer,
  PageTitle,
  ThemedText,
} from '@/components';
import { PageSurface } from '@/components/PageSurface';
import { getResponsiveContentContainerStyle } from '@/constants/responsiveStyles';
import { Size } from '@/constants/theme';
import { useResponsive } from '@/hooks/useResponsive';
import type { ImageSourcePropType } from 'react-native';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { WebMetadata } from '@/utils/webMetadata';

const IMG_HOMEPAGE =
  require('@/assets/images/help_homepage.png') as ImageSourcePropType;
const IMG_HOMEPAGE_PLANTS =
  require('@/assets/images/help_homepage_plants.png') as ImageSourcePropType;
const IMG_SEARCH_SIMPLE =
  require('@/assets/images/help_search_simple.png') as ImageSourcePropType;
const IMG_ENV_FEATURES =
  require('@/assets/images/help_env_features.png') as ImageSourcePropType;
const IMG_CATEGORICAL_FEATURES =
  require('@/assets/images/help_categorical_features.png') as ImageSourcePropType;
const IMG_WEATHER_CODE =
  require('@/assets/images/help_weather_code.png') as ImageSourcePropType;
const IMG_LOCATION_FILTER =
  require('@/assets/images/help_location_filter.png') as ImageSourcePropType;
const IMG_LOCATION_FILTER_APPLIED =
  require('@/assets/images/help_location_filter_applied.png') as ImageSourcePropType;
const IMG_SLICING =
  require('@/assets/images/help_slicing.png') as ImageSourcePropType;
const IMG_SLICING_MAP =
  require('@/assets/images/help_slicing_map.png') as ImageSourcePropType;
const IMG_CATEGORICAL_HIGHLIGHTED =
  require('@/assets/images/help_categorical_highlighted.png') as ImageSourcePropType;
const IMG_OUT_OF_RANGE =
  require('@/assets/images/help_out_of_range.png') as ImageSourcePropType;
const IMG_OUT_OF_RANGE_CATEGORICAL =
  require('@/assets/images/help_out_of_range_categorical.png') as ImageSourcePropType;
const IMG_ML_MODEL =
  require('@/assets/images/help_ml_model.png') as ImageSourcePropType;
const IMG_ML_MODEL_ZOOMED =
  require('@/assets/images/help_ml_model_zoomed.png') as ImageSourcePropType;
const IMG_SEARCH_FILTER =
  require('@/assets/images/help_search_filter.png') as ImageSourcePropType;
const IMG_SEARCH_CACTI_TEMP =
  require('@/assets/images/help_search_cacti_temp.png') as ImageSourcePropType;
const IMG_SEARCH_CACTI_SNOW =
  require('@/assets/images/help_search_cacti_snow.png') as ImageSourcePropType;
const IMG_CUSTOM_DATA =
  require('@/assets/images/help_custom_data.png') as ImageSourcePropType;

// Inline link for use nested inside a parent ThemedText (body paragraph).
// Using nested Text renders truly inline without flex-row newline artifacts.
function L({ url, children }: { url: string; children: string }) {
  return (
    <ThemedText variant='link' onPress={() => Linking.openURL(url)}>
      {children}
    </ThemedText>
  );
}

export default function HelpScreen() {
  const responsive = useResponsive();
  return (
    <>
      {Platform.OS === 'web' ? (
        <WebMetadata
          title='WhereWild | Help'
          description='Learn how to search species, interpret maps, and use WhereWild effectively.'
          path='/help'
        />
      ) : null}
      <PageSurface>
        <PageScrollContainer
          contentContainerStyle={getResponsiveContentContainerStyle(
            responsive,
            {
              includeHorizontalPadding: false,
              includeBottomPadding: true,
              includeGap: true,
            },
          )}
          bounces={false}
        >
          {Platform.OS === 'web' ? <PageTitle title='Help' /> : null}

          <View
            style={[
              styles.contentShell,
              getResponsiveContentContainerStyle(responsive, {
                includeWidth: false,
                includeTopPadding: false,
              }),
            ]}
          >
            <View style={[styles.content, { maxWidth: responsive.textWidth }]}>
              {/* ── Title ───────────────────────────────────────────────── */}
              <ThemedText variant='heading'>
                {'How do I use WhereWild?'}
              </ThemedText>

              {/* ── Homepage ─────────────────────────────────────────────── */}
              <View style={styles.section}>
                <ThemedText variant='heading'>{'Homepage'}</ThemedText>
                <ThemedText variant='body'>
                  {
                    'The easiest place to start is on the homepage. On the homepage, you\'ll see a heatmap, and a list of "recommended species" on the right side:'
                  }
                </ThemedText>
                <ContentImage
                  source={IMG_HOMEPAGE}
                  label='WhereWild homepage showing a heatmap and recommended species list'
                />
                <ThemedText variant='body'>
                  {
                    'This map updates every few hours based on the actual recent weather. The recommendations are then given by what kind of weather is contributing to the species having a high predicted probability of being found within the viewport, and what kind of locations they will be in. You can see the Mule Deer is near the top of the list and seems to be concentrated in areas with clear skies and sparse vegetation.'
                  }
                </ThemedText>
                <ThemedText variant='body'>
                  {
                    'You can even update the map to only recommend species of a certain type of organism. If you only care about plants, you can filter to plants only by clicking the button on the right. It will then only show plants, along with reasons as to why they might be flowering right now:'
                  }
                </ThemedText>
                <ContentImage
                  source={IMG_HOMEPAGE_PLANTS}
                  label='WhereWild homepage filtered to plants only'
                />
                <ThemedText variant='body'>
                  {
                    'If you have a specific species in mind, you can find it by simply searching for it in the top bar. You can search one of its common names or its scientific name, and it will be matched either way.'
                  }
                </ThemedText>
                <ContentImage
                  source={IMG_SEARCH_SIMPLE}
                  label='Species search bar with a simple query'
                />
              </View>

              {/* ── Species page ─────────────────────────────────────────── */}
              <View style={styles.section}>
                <ThemedText variant='heading'>{'Species page'}</ThemedText>

                {/* Description and image */}
                <View style={styles.subsection}>
                  <ThemedText variant='subheading'>
                    {'Description and image'}
                  </ThemedText>
                  <ThemedText variant='body'>
                    {"Once you're on a species page (here's a "}
                    <L url='https://wherewild.net/species/2750737/calochortus-nuttallii'>
                      {'link'}
                    </L>
                    {
                      " to an example one!), you'll notice it starts out with an image and a description. Keep this page open if you want to follow along with a tutorial."
                    }
                  </ThemedText>
                  <ThemedText variant='body'>
                    {
                      'The description should be an easy way to get a general idea of the habitat of a species without needing any formal knowledge, or having to parse lots of its data. Think of it as analogous to a field guide entry.'
                    }
                  </ThemedText>
                  <ThemedText variant='body'>
                    {
                      'Keep in mind the descriptions are automatically generated from the data '
                    }
                    <ThemedText variant='bodyStrong'>
                      {'and do not use Generative AI'}
                    </ThemedText>
                    {
                      ' in any way. The algorithm is entirely rule-based and works off simple thresholds for the most part. This means there are simplifications made so it can work reasonably well across the many different types of life in our project. If you want more in-depth information about a species, scroll down to the environmental features section.'
                    }
                  </ThemedText>
                </View>

                {/* Environmental features */}
                <View style={styles.subsection}>
                  <ThemedText variant='subheading'>
                    {'Environmental features'}
                  </ThemedText>
                  <ThemedText variant='body'>
                    {
                      'The environmental features section is the part of the species page where in-depth analysis of how its observations relate to the environment can be done. Take a look at an example entry for Annual Mean Temperature:'
                    }
                  </ThemedText>
                  <ContentImage
                    source={IMG_ENV_FEATURES}
                    label='Environmental features section showing a density graph for Annual Mean Temperature'
                  />
                  <ThemedText variant='body'>
                    {'Displayed is a '}
                    <ThemedText variant='bodyEmphasis'>
                      {'density graph '}
                    </ThemedText>
                    {
                      'across all observations with respect to the annual mean temperature at those locations. This means areas with higher density have a larger area under the curve. This example forms something of a bell curve. This species seems to prefer areas where the average temperature is around 46 degrees Fahrenheit, but can tolerate averages all the way up to 58 and all the way down to 32.'
                    }
                  </ThemedText>

                  <View style={styles.subsubsection}>
                    <ThemedText variant='bodyStrong'>
                      {'Relative Rankings'}
                    </ThemedText>
                    <ThemedText variant='body'>
                      {
                        'A natural reaction might be: why does that matter? 46 degrees can seem like an arbitrary number. It does not mean much to the average person to know that the "average annual temperature" at a location is some value. This is where the '
                      }
                      <ThemedText variant='bodyEmphasis'>
                        {'relative rankings '}
                      </ThemedText>
                      {
                        'come in. Note the pills at the bottom with the current selection of "Calochortus". They are sorted in ascending order of taxonomic rank, so this is the genus that the species is within. We can see that the species is within the 23rd percentile for its mean of this variable within its genus. If we go all the way up to Plantae, we observe it is in the 14th percentile. This shows that it grows in colder areas compared to other plants it\'s related to, and much colder areas than plants overall.'
                      }
                    </ThemedText>
                  </View>

                  <View style={styles.subsubsection}>
                    <ThemedText variant='bodyStrong'>
                      {'Dozens of variables'}
                    </ThemedText>
                    <ThemedText variant='body'>
                      {
                        'The environmental features section supports dozens of variables across four categories. The "Bioclimatic" section includes lots of variables based on averages for temperature, precipitation, and other weather patterns. "Earth Surface" contains landcover and soil/lithology data. "Terrain" contains information about geography such as elevation, slope, and aspect.'
                      }
                    </ThemedText>
                  </View>

                  <View style={styles.subsubsection}>
                    <ThemedText variant='bodyStrong'>
                      {'Categorical variables'}
                    </ThemedText>
                    <ThemedText variant='body'>
                      {
                        'Some variables we have are categorical, meaning their values represent the class a location belongs to. For example, landcover defines what kind of features cover the land, as you can see in the example below:'
                      }
                    </ThemedText>
                    <ContentImage
                      source={IMG_CATEGORICAL_FEATURES}
                      label='Categorical environmental feature showing landcover distribution'
                    />
                  </View>

                  <View style={styles.subsubsection}>
                    <ThemedText variant='bodyStrong'>
                      {'Recent weather'}
                    </ThemedText>
                    <ThemedText variant='body'>
                      {
                        'Finally, we even include data for what the recent weather was like '
                      }
                      <ThemedText variant='bodyEmphasis'>
                        {'at the time of observation'}
                      </ThemedText>
                      {
                        '. This can help find patterns in whether the species is often observed after rainfall, during cold weather, or under other conditions. We compute the weather code, which is the interpretable label for the weather at the time of observation:'
                      }
                    </ThemedText>
                    <ContentImage
                      source={IMG_WEATHER_CODE}
                      label='Weather code distribution showing most observations occur in clear skies or cloudy weather'
                    />
                    <ThemedText variant='body'>
                      {
                        "As we can see here, most are observed during clear skies or cloudy weather - but remember this distribution will be biased, since most people don't go outside taking photos of wildlife when it's pouring outside!"
                      }
                    </ThemedText>
                    <ThemedText variant='body'>
                      {
                        'We also include variables like air temperature at various aggregation windows, such as averages over sliding windows of 1 hour, 8 hours, 24 hours, 1 week, 1 month, and 3 months. The idea is that recent weather might influence when animals are active or whether plants are likely to flower or fruit. For example, if a given winter is warmer and milder, plants might flower earlier. We can then use observation timing data to infer what kinds of weather patterns support flowering.'
                      }
                    </ThemedText>
                  </View>

                  <View style={styles.subsubsection}>
                    <ThemedText variant='bodyStrong'>
                      {'Location filtering'}
                    </ThemedText>
                    <ThemedText variant='body'>
                      {
                        "Let's say you are really fond of your home area and want to learn more specifically about how a species is distributed "
                      }
                      <ThemedText variant='bodyEmphasis'>
                        {'only within your county'}
                      </ThemedText>
                      {
                        ', since it might have a different distribution nearby compared to its distribution overall.'
                      }
                    </ThemedText>
                    <ThemedText variant='body'>
                      {
                        'You can use the location filter at the top of the environmental features section to accomplish this:'
                      }
                    </ThemedText>
                    <ContentImage
                      source={IMG_LOCATION_FILTER}
                      label='Location filter UI at the top of the environmental features section'
                    />
                    <ThemedText variant='body'>
                      {
                        'Note results will be filtered to only locations where the species '
                      }
                      <ThemedText variant='bodyEmphasis'>{'has '}</ThemedText>
                      {
                        'been observed. It will also sort results by the number of observations recorded in the location. That makes it easy to filter this species to Salt Lake County, where it has a high density of observations.'
                      }
                    </ThemedText>
                    <ThemedText variant='body'>
                      {'This updates the environmental features section to '}
                      <ThemedText variant='bodyEmphasis'>{'only '}</ThemedText>
                      {'show values observed within this location:'}
                    </ThemedText>
                    <ContentImage
                      source={IMG_LOCATION_FILTER_APPLIED}
                      label='Environmental features section filtered to Salt Lake County'
                    />
                    <ThemedText variant='body'>
                      {
                        'In this example, compared with the landcover data for its global distribution above, it is much more common in forested areas in SLCo and much less common in shrublands. This means you would want to focus less on shrublands if you were trying to find this plant in SLCo, which is useful to know.'
                      }
                    </ThemedText>
                    <ThemedText variant='body'>
                      {
                        "It will also update the map to only show observations in the map! ...so let's talk about the map."
                      }
                    </ThemedText>
                  </View>
                </View>

                {/* Observations map */}
                <View style={styles.subsection}>
                  <ThemedText variant='subheading'>
                    {'Observations map'}
                  </ThemedText>
                  <ThemedText variant='body'>
                    {
                      'The observations map is simply a map of all observations of the species, as specified by the GBIF data. This means it is all research grade observations present on iNaturalist for the species.'
                    }
                  </ThemedText>
                  <ThemedText variant='body'>
                    {
                      'On its own, it is not especially interesting to look at. It is not very different from the iNaturalist map. But there are a few features that make it much more worthwhile.'
                    }
                  </ThemedText>

                  <View style={styles.subsubsection}>
                    <ThemedText variant='bodyStrong'>
                      {'Observation slicing'}
                    </ThemedText>
                    <ThemedText variant='body'>
                      {
                        "Something we might be interested in is finding outlier observations - that is, observations of this species that occur in really extreme conditions compared to the rest. For example, the description states it can occur at over 10,000 feet elevation. That's pretty high up! But "
                      }
                      <ThemedText variant='bodyEmphasis'>{'where '}</ThemedText>
                      {'does it occur at such high elevations?'}
                    </ThemedText>
                    <ThemedText variant='body'>
                      {
                        'What we can do is go back up to the environmental features for elevation, and click and drag on the upper portion of the density graph. This will "highlight" part of the density graph like so, and state that we\'ve selected a certain range of elevation that contains a certain amount of the overall observations:'
                      }
                    </ThemedText>
                    <ContentImage
                      source={IMG_SLICING}
                      label='Density graph with a slice selected on the upper elevation range'
                    />
                    <ThemedText variant='body'>
                      {
                        'This highlights all observations within that "slice" (range) to be red on the observation map. So we can see exactly where in the world the high elevation observations of this plant are. We can do the same for a categorical variable such as landcover by simply clicking on its pill or bar in its environmental features section.'
                      }
                    </ThemedText>
                    <ContentImage
                      source={IMG_SLICING_MAP}
                      label='Observation map with high-elevation observations highlighted in red'
                    />
                    <ThemedText variant='body'>
                      {
                        'If we click on a specific observation, we can see that it pulls up a dialogue. We can click on the upper button and it will take us to a page with the iNaturalist observation, so we can observe what that observation actually was and its related images. We can also click the lower button to highlight its location in the environmental features...'
                      }
                    </ThemedText>
                  </View>

                  <View style={styles.subsubsection}>
                    <ThemedText variant='bodyStrong'>
                      {'Highlighting in environmental features'}
                    </ThemedText>
                    <ThemedText variant='body'>
                      {
                        'After clicking on "highlight in Environmental Features", we can go back up to the environmental features section and notice a vertical yellow line in the density graph. Unsurprisingly, it should be within range of the slice we have made, since it was highlighted. However, this works for any variable; going back to a variable such as Annual Mean Temperature, we can see the observation has an average temperature that is below what is average for this species, but still obviously within range. This is perhaps not surprising as a higher elevation location will be cooler.'
                      }
                    </ThemedText>
                    <ThemedText variant='body'>
                      {
                        'This also works for categorical variables like landcover, where the class it belongs to will be highlighted:'
                      }
                    </ThemedText>
                    <ContentImage
                      source={IMG_CATEGORICAL_HIGHLIGHTED}
                      label='Categorical landcover feature with a specific observation class highlighted'
                    />
                    <ThemedText variant='body'>
                      {
                        'All in all, this allows you to get a clear idea of what the environment is like for a specific observation, and how it relates to other observations of its species.'
                      }
                    </ThemedText>
                  </View>

                  <View style={styles.subsubsection}>
                    <ThemedText variant='bodyStrong'>
                      {'Highlighting arbitrary locations'}
                    </ThemedText>
                    <ThemedText variant='body'>
                      {'We can highlight '}
                      <ThemedText variant='bodyEmphasis'>{'any '}</ThemedText>
                      {
                        "area in the environmental features section, not just an area where the species has been observed. Let's say you live in Reno, where there are no nearby observations of this species, but still wonder if you could grow it in your garden with a bit of extra care. Clicking around the area of Reno on the map, you can place a pin just like normal, and see it show up in the environmental features section."
                      }
                    </ThemedText>
                    <ThemedText variant='body'>
                      {
                        "Clicking through multiple variables, we see that pretty much all of the values are within range. So it's perhaps possible to grow it in Reno, despite the fact there are no nearby occurrences of it."
                      }
                    </ThemedText>
                    <ThemedText variant='bodyEmphasis'>
                      {
                        "...if the climate of Reno is similar to the climate of other areas it grows in, why isn't it already in Reno?"
                      }
                    </ThemedText>
                    <ThemedText variant='body'>
                      {
                        'That is the key question, and it is a very difficult one to answer. In general, ecosystems are complex and there is a great deal of natural history involved. In this case, it may be because there are already other species of Calochortus in the area that are slightly better adapted and fill the same ecological niche.'
                      }
                    </ThemedText>
                    <ThemedText variant='body'>
                      {'What we '}
                      <ThemedText variant='bodyEmphasis'>{'can '}</ThemedText>
                      {
                        'be sure of is that an area like Florida would likely be completely incompatible for this plant. This may seem intuitive, but we now have data to support that conclusion. Highlighting an area in Florida, we can see the values are completely out of range for most variables:'
                      }
                    </ThemedText>
                    <ContentImage
                      source={IMG_OUT_OF_RANGE}
                      label='Continuous environmental feature showing a highlighted location in Florida is out of range'
                    />
                    <ContentImage
                      source={IMG_OUT_OF_RANGE_CATEGORICAL}
                      label='Categorical environmental feature showing a highlighted location in Florida is out of range'
                    />
                  </View>

                  <View style={styles.subsubsection}>
                    <ThemedText variant='bodyStrong'>
                      {'Machine learning maps'}
                    </ThemedText>
                    <ThemedText variant='body'>
                      {
                        'For a select few species, we go as far as training models to predict which locations have a compatible habitat for them. This is because it can be hard to keep a running list of what conditions each species prefers and each area has in your head. We can click "show predictive heatmap" and it will display a heatmap of which areas the species is likely to be found in, based on our model\'s predictions.'
                      }
                    </ThemedText>
                    <ContentImage
                      source={IMG_ML_MODEL}
                      label='Species page showing a predictive habitat heatmap'
                    />
                    <ThemedText variant='body'>
                      {
                        'You can toggle what kind of model to display; "Habitat" means what areas the species can be found in, regardless of the weather (e.g. where '
                      }
                      <ThemedText variant='bodyEmphasis'>{'could '}</ThemedText>
                      {
                        'it be). "Habitat + flowering" for plants means it will only show areas both in which the plant can be found, and where it is likely flowering given the current weather; for animals and fungi, this will just show areas they might actually be (since animals move around and fungi are typically only observed as mushrooms which are the fruiting body). "Conditions only" displays a map of where the plant might be flowering given only the weather for example, with no notion of whether the habitat is actually compatible.'
                      }
                    </ThemedText>
                    <ThemedText variant='body'>
                      {
                        'You can zoom in on the map and it will update its resolution, so you can get a very fine-grained idea of what locations might suit it the most in a given area.'
                      }
                    </ThemedText>
                    <ContentImage
                      source={IMG_ML_MODEL_ZOOMED}
                      label='Predictive heatmap zoomed in to show fine-grained habitat predictions'
                    />
                  </View>
                </View>
              </View>

              {/* ── Search page ──────────────────────────────────────────── */}
              <View style={styles.section}>
                <ThemedText variant='heading'>{'Search page'}</ThemedText>
                <ThemedText variant='body'>
                  {
                    'The search page is a great way to do more in-depth queries on the species we have in our project, and even sort results by given variables and metrics.'
                  }
                </ThemedText>
                <ThemedText variant='body'>
                  {
                    'Try searching for something like "oak" and pressing Enter. This will pull up a results page with all matches. Click the "filter" button in the top bar to open the popup. It will look something like this:'
                  }
                </ThemedText>
                <ContentImage
                  source={IMG_SEARCH_FILTER}
                  label='Search page with the filter panel pulled up'
                />
                <ThemedText variant='body'>
                  {
                    'Let\'s say we now want to filter results to ones that are only within a certain category of organism. Let\'s say we\'re interested in cacti today, so we type in "Cacti" on the base taxon entry. There won\'t be any more matches for "oak" anymore, so we can remove that from the top search bar. It should now pull up a list of all cacti, sorted by the variable and metric defined below; for example, by their average annual mean temperature:'
                  }
                </ThemedText>
                <ContentImage
                  source={IMG_SEARCH_CACTI_TEMP}
                  label='Search results showing cacti sorted by average annual mean temperature'
                />
                <ThemedText variant='body'>
                  {
                    "So we can see which cacti grow in areas that are generally the coldest. There are lots of ways we can refine the search here; let's use an example. Those who have tried to garden cacti will know they "
                  }
                  <ThemedText variant='bodyEmphasis'>{'typically '}</ThemedText>
                  {
                    "don't tolerate snowy winters very well as they are prone to root rot. But we might be interested in finding cacti species that "
                  }
                  <ThemedText variant='bodyEmphasis'>{'can '}</ThemedText>
                  {
                    'tolerate snowy winters, at least compared to other cacti, if you were trying to garden them in a snowy location like SLCo. So we can pick a variable like "Snow water equivalent", sort by descending so we get results with the most snow, and choose the max as the metric, since we want to know the upper range of the species\' snow tolerance. We can also filter the location to only the US since South American species are harder to obtain. We could make it return more results up to 200 if we wanted to, and filter results with less than a certain number of observations, but we leave those options for now.'
                  }
                </ThemedText>
                <ContentImage
                  source={IMG_SEARCH_CACTI_SNOW}
                  label='Search results showing cacti sorted by maximum snow water equivalent'
                />
                <ThemedText variant='body'>
                  {
                    "Now this gives us a list of all cacti found in the United States by their upper limit of how much snow they can tolerate. Exactly the candidate list we wanted! If we were super dedicated, we could go as far as opening their species pages, going to snow water equivalent in their environmental features section, highlighting the upper end of their range, and then finding exactly what locations these species experience the most snow, so we know which areas are the best to harvest seeds from to cultivate. But I'll leave that to you..."
                  }
                </ThemedText>
                <ThemedText variant='body'>
                  {
                    "This is a very powerful way to just find cool and interesting outlier species. Have a backyard that's super hot and dry and sunny, but still want to garden? You can use this functionality to find plants that live in your area that are at the top of the list for temperature and lack of precipitation! Just interested in finding animals that thrive in extreme environments? You can do that too!"
                  }
                </ThemedText>
              </View>

              {/* ── Settings page ────────────────────────────────────────── */}
              <View style={styles.section}>
                <ThemedText variant='heading'>{'Settings page'}</ThemedText>
                <ThemedText variant='body'>
                  {
                    "We can't forget the settings page. WhereWild supports changing the units used throughout the app and the color theme. There might also be an option to set a home location to have it be highlighted in environmental features sections by default, (coming soon!)."
                  }
                </ThemedText>
              </View>

              {/* ── Custom data uploading ────────────────────────────────── */}
              <View style={styles.section}>
                <ThemedText variant='heading'>
                  {'Custom data uploading'}
                </ThemedText>
                <ThemedText variant='body'>
                  {
                    'Finally, we get to the final functionality we have in custom data uploading. We support this since we use iNaturalist data, which has a few drawbacks:'
                  }
                </ThemedText>
                <View style={styles.bulletList}>
                  <ThemedText variant='body'>
                    {
                      '\u2022  It\u2019s crowdsourced, and research grade only takes two agreements on the species level. People may blindly trust the computer vision, so species labels may be erroneous'
                    }
                  </ThemedText>
                  <ThemedText variant='body'>
                    {
                      '\u2022  Taxonomy may not line up with what the user wants'
                    }
                  </ThemedText>
                  <ThemedText variant='body'>
                    {
                      '\u2022  Observations are biased towards urban or more heavily trafficked areas, North America, and during the summer months/good weather'
                    }
                  </ThemedText>
                  <ThemedText variant='body'>
                    {
                      '\u2022  Some taxa have all observations obscured on iNaturalist, meaning we cannot serve results for them'
                    }
                  </ThemedText>
                </View>
                <ThemedText variant='body'>
                  {
                    "Because of this, we support the user uploading of certain types of datasets that we will then process. But it's important to make clear what uploading is and is not; uploading data is NOT like iNaturalist where you can upload individual observations that other people will be able to see and identify. It is solely for the uploading of coordinates that we enrich with environmental data and return to the user, nothing more."
                  }
                </ThemedText>
                <ThemedText variant='body'>
                  {
                    'All that is required is a csv containing occurrence data such as a columns for latitude and longitude (note: we do not support enriching temporal/recent weather data at this time). Like this one for example. It can have a column for ids but this is not required. Simply go to the upload page from the header and upload the csv for part 1. Relatively quickly, it should return a zip file you will be prompted to download.'
                  }
                </ThemedText>
                <ThemedText variant='body'>
                  {
                    'Next, click on the step 2 dialogue and upload the zip you just downloaded. It should pull up an environmental features section and map right there, with all of your observations in it!'
                  }
                </ThemedText>
                <ContentImage
                  source={IMG_CUSTOM_DATA}
                  label='Custom data upload page showing the environmental features section for uploaded observations'
                />
                <ThemedText variant='body'>
                  {
                    "We support much of the same functionality here as we do on the species page such as slicing and location highlighting. We don't support relative ranks or location filtering as it would make it significantly more complex."
                  }
                </ThemedText>
                <ThemedText variant='body'>
                  {
                    'Finally, note that step 2 is more of a step to have the same easy visualization we have for other species. But the zip file contains all of the enriched data necessary for this! So more advanced/experienced users can use these files for whatever kind of analysis they want after the fact; the '
                  }
                  <ThemedText variant='code'>{'occurrence.parquet'}</ThemedText>
                  {
                    ' file contains most of the important stuff, many of the other files are WhereWild-specific and needed for the frontend display.'
                  }
                </ThemedText>
              </View>

              {/* ── That's a wrap ────────────────────────────────────────── */}
              <View style={styles.section}>
                <ThemedText variant='heading'>
                  {'That\u2019s a wrap!'}
                </ThemedText>
                <ThemedText variant='body'>
                  {
                    'That about does it for the functionality of the project! If you have any questions, please contact '
                  }
                  <L url='mailto:mountgambeloak@gmail.com'>
                    {'mountgambeloak@gmail.com'}
                  </L>
                  {
                    ', or come ask us something on Demo Day! (Wednesday April 22, 1:00-4:00 PM, University of Utah Alumni House)'
                  }
                </ThemedText>
              </View>
            </View>
          </View>
        </PageScrollContainer>
      </PageSurface>
    </>
  );
}

const styles = StyleSheet.create({
  contentShell: {
    width: '100%',
    alignItems: 'center',
  },
  content: {
    width: '100%',
    alignSelf: 'center',
    gap: Size.space.text.section,
  },
  section: {
    gap: Size.space.text.subsection,
  },
  subsection: {
    gap: Size.space.text.paragraph,
  },
  subsubsection: {
    gap: Size.space.text.paragraph,
  },
  bulletList: {
    gap: Size.space.text.line,
    paddingLeft: Size.space['400'],
  },
});
