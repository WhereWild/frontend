#!/usr/bin/env python3
# SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
#
# SPDX-License-Identifier: MIT
"""Fetch an EPA ecoregion shapefile for a US state and pre-style it for
/gis-editor -- an example of how to build a "custom layer" from scratch,
outside the browser, that /gis-editor picks up already configured.

WHAT THIS DOES
    1. Finds the state's ecoregion shapefile on the EPA's own site
       (https://www.epa.gov/eco-research/ecoregion-download-files-state-region-N,
       one page per EPA region, N = 1..10 -- this script checks all of them,
       since which region hosts a given state isn't shown anywhere else and
       occasionally isn't obvious from the state's own EPA region).
    2. Downloads and unzips it, then actually parses its geometry (every
       polygon vertex) and reprojects it from whatever projected coordinate
       system the EPA published it in into plain WGS84-ish lon/lat degrees
       (real ellipsoidal Albers Equal-Area Conic math -- see ALBERS
       REPROJECTION below), since a single GeoJSON file has no per-file CRS
       of its own to carry a projection in (RFC 7946 fixes it at WGS84).
    3. Picks an ecoregion-name column from its attribute table (the actual
       column name varies -- Level III shapefiles typically use US_L3NAME,
       Level IV use US_L4NAME -- so this looks for it rather than assuming),
       prefixes it with its parent region's name for disambiguation (EPA
       reuses names like "Alpine Zone" under different parent regions --
       see find_parent_name_field()'s docstring), and assigns each distinct
       result a color.
    4. Adds three properties to every feature: WW_MODE, WW_FIELD, WW_COLOR.
       This is exactly the convention /gis-editor's own "Save" writes and
       reads back (see components/gisEditor/shapefileWriter.ts and
       shapefileMetadata.ts in this repo) -- it's a real, documented
       format, not internal-only, so anything that writes these same
       three properties onto a GeoJSON FeatureCollection produces a file
       /gis-editor opens pre-styled. This script is one example of that;
       it isn't a special/blessed path.
    5. Writes the whole thing out as a single .geojson file. Drop it into
       /gis-editor and it opens already colored by ecoregion, with names
       already filled in -- no sidecar files, no bundle to keep together.

WHY GEOJSON, NOT THE ORIGINAL SHAPEFILE FORMAT
    An ESRI Shapefile is inherently a bundle of separate files (.shp for
    geometry, .dbf for attributes, .prj for the coordinate system, plus
    optional others) that only work together -- there's no way to make
    that "just one file" without changing format entirely. GeoJSON has
    everything (geometry + arbitrary attributes, with the coordinate
    system fixed by the spec) in one plain-text file, and /gis-editor
    reads it directly with no bundle to keep track of. The tradeoff: this
    script now has to actually parse and reproject every polygon's
    vertices (Shapefile's original per-state coordinate systems aren't
    WGS84), rather than just copying the geometry through untouched the
    way a same-format DBF-only edit could.

ALBERS REPROJECTION
    Every EPA per-state/national ecoregion shapefile checked while writing
    this (a sample across multiple EPA regions, plus the national and
    Alaska files) uses some form of ellipsoidal Albers Equal-Area Conic
    (Snyder 1987, "Map Projections: A Working Manual") -- USA Contiguous
    Albers (EPSG:5070) for the lower 48, Alaska's own Albers (EPSG:3338)
    for --country's Alaska fetch. This isn't hardcoded to those two
    specific cases though: parse_prj() reads whichever Albers parameters
    (or plain geographic coordinates) are actually declared in each file's
    own .prj, so it keeps working if EPA ever republishes under a
    different-but-still-Albers definition. The inverse-projection math
    itself was cross-checked against `pyproj` on both real parameter sets
    to 8 decimal places while writing this, without adding pyproj as a
    runtime dependency of the shipped script.

--COUNTRY
    Rather than fetching all 50 states and stitching their individually-cut
    shapefiles back together at the seams (fiddly, and risks
    duplicated/misaligned polygons along state borders), this uses the
    EPA's own seamless nationwide file for the lower 48
    (us_eco_l3.zip/us_eco_l4.zip -- confirmed to exist on
    https://www.epa.gov/eco-research/level-iii-and-iv-ecoregions-continental-united-states
    while writing this) and adds Alaska (not included in that file) from its
    own per-state file. No file anywhere combines the two at this same
    "US_L3/US_L4" level of detail (checked, including the EPA's
    continent-wide NA_CEC_Eco_Level3.zip, which turns out to be a coarser,
    different classification without the US_L3 refinement at all). Hawaii
    isn't part of the EPA's ecoregion system at all (checked all 10 region
    pages) and can't be included from this data source.

    Alaska has no Level IV data at all -- since --level defaults to 4,
    `--country` on its own covers the lower 48 only; pass `--level 3` to
    also fetch and merge in Alaska.

WHY NO THIRD-PARTY DEPENDENCIES
    Standard library only (urllib, zipfile, struct, re, colorsys, math,
    json, ...) -- no `pip install` needed. The Shapefile binary formats
    (.shp geometry, .dbf attributes) are small and stable enough to read
    directly; this doubles as a from-scratch reference for both formats,
    and for the Albers math, without pulling in pyshp/pyproj/GDAL.

USAGE
    python3 fetch_state_ecoregions.py "Montana"
    python3 fetch_state_ecoregions.py "New York" --level 3 --output ./ny.geojson
    python3 fetch_state_ecoregions.py --country
    python3 fetch_state_ecoregions.py --country --level 3   # also include Alaska
"""

from __future__ import annotations

import argparse
import colorsys
import io
import json
import math
import re
import struct
import sys
import zipfile
from dataclasses import dataclass
from pathlib import Path
from urllib.request import Request, urlopen

USER_AGENT = "Mozilla/5.0 (compatible; wherewild-ecoregion-fetcher/1.0)"
EPA_REGION_PAGE = (
    "https://www.epa.gov/eco-research/ecoregion-download-files-state-region-{n}"
)
NUM_EPA_REGIONS = 10

STATE_NAMES = [
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado",
    "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho",
    "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana",
    "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota",
    "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
    "New Hampshire", "New Jersey", "New Mexico", "New York",
    "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon",
    "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
    "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington",
    "West Virginia", "Wisconsin", "Wyoming", "District of Columbia",
]


def resolve_state_name(user_input: str) -> str:
    """Matches loosely (case/whitespace-insensitive) against the real US
    state list, so "montana", "MONTANA", or "  Montana  " all work -- but
    still fails loudly on a typo rather than silently searching for
    whatever garbage was typed.
    """
    normalized = " ".join(user_input.strip().split()).lower()
    for name in STATE_NAMES:
        if name.lower() == normalized:
            return name
    raise SystemExit(
        f"'{user_input}' isn't a US state name I recognize. "
        f'Spell it out in full, e.g. "North Dakota" (not "ND").'
    )


def fetch(url: str) -> bytes:
    request = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=60) as response:  # noqa: S310 (fixed https EPA/AWS hosts only)
        return response.read()


# --- Finding the download link on the EPA's site ---------------------------

LEVEL_TEXT = {3: "level iii", 4: "level iv"}

# Most regions give each state its own <h2 class="highlight">StateName</h2>
# section. Region 1 is the one exception (verified against the live page
# while writing this): New England's six states are nested as <h4>StateName
# </h4> sub-headings inside one single <h2 class="highlight">New England
# </h2> section. Treating every h2.highlight AND h4 as one combined,
# document-order list of headings handles both shapes the same way: a
# state's own content is just "up to the next heading of either kind" --
# without needing to special-case the New England grouping at all. If EPA
# ever restructures the page beyond this, this will just stop matching and
# say so, not silently return nothing useful.
_HEADING_RE = re.compile(
    r'<h2 class="highlight">\s*(?:<a[^>]*></a>\s*)?([^<]+?)\s*</h2>'
    r"|<h4>\s*([^<]+?)\s*</h4>",
    re.IGNORECASE,
)
_ZIP_LINK_RE = re.compile(
    r'<a\s+href="([^"]+\.zip)"[^>]*>([^<]*)</a>', re.IGNORECASE
)


def iter_state_sections(html: str):
    """Yields (heading_text, section_html) for every h2.highlight/h4 heading
    in document order, each paired with the HTML between it and the next
    heading of either kind (or the end of the page)."""
    headings = [
        (m.start(), m.end(), (m.group(1) or m.group(2)))
        for m in _HEADING_RE.finditer(html)
    ]
    for i, (_, end, text) in enumerate(headings):
        next_start = headings[i + 1][0] if i + 1 < len(headings) else len(html)
        yield text.strip(), html[end:next_start]


def find_shapefile_url(state_name: str, level: int) -> str:
    candidates: list[tuple[str, str]] = []  # (url, anchor text)
    checked_pages = 0
    for region in range(1, NUM_EPA_REGIONS + 1):
        url = EPA_REGION_PAGE.format(n=region)
        try:
            html = fetch(url).decode("utf-8", errors="replace")
        except Exception as error:  # noqa: BLE001 - report and keep going
            print(f"  (couldn't check region {region}: {error})", file=sys.stderr)
            continue
        checked_pages += 1
        for heading, body in iter_state_sections(html):
            if heading.lower() != state_name.lower():
                continue
            for href, text in _ZIP_LINK_RE.findall(body):
                candidates.append((href, text))

    if not candidates:
        raise SystemExit(
            f"Couldn't find {state_name} on any of the {checked_pages} EPA "
            f"ecoregion region pages checked. The EPA may have reorganized "
            f"the site -- see {EPA_REGION_PAGE.format(n=1)} to check by hand."
        )

    # Prefer a link whose own text says which level it is; states with only
    # one combined shapefile (e.g. Wyoming) don't split by level at all --
    # if there's exactly one candidate, use it regardless of what it's
    # called.
    wanted = LEVEL_TEXT[level]
    for href, text in candidates:
        if wanted in text.lower():
            return href
    if len(candidates) == 1:
        return candidates[0][0]

    print(
        f"  No link explicitly labeled '{wanted}' for {state_name}; "
        f"found: {[text for _, text in candidates]}. Using the first one.",
        file=sys.stderr,
    )
    return candidates[0][0]


# --- Minimal DBF (dBase III, no memo) reader --------------------------------
#
# Only a reader now -- properties end up as plain JSON in the output
# GeoJSON, not written back into another fixed-width .dbf, so there's no
# writer half needed here anymore (contrast with
# components/gisEditor/shapefileWriter.ts's buildDbf() in this repo, which
# still needs one: it's editing an actual .dbf in place).


@dataclass
class DbfField:
    name: str
    type: str  # 'C' (character), 'N' (numeric), or 'L' (logical)
    length: int
    decimals: int = 0


def read_dbf(data: bytes) -> tuple[list[DbfField], list[dict[str, object]]]:
    num_records = struct.unpack_from("<I", data, 4)[0]
    header_length = struct.unpack_from("<H", data, 8)[0]
    record_length = struct.unpack_from("<H", data, 10)[0]

    fields: list[DbfField] = []
    offset = 32
    while data[offset] != 0x0D:
        name = data[offset : offset + 11].split(b"\x00")[0].decode("ascii")
        field_type = chr(data[offset + 11])
        length = data[offset + 16]
        decimals = data[offset + 17]
        fields.append(DbfField(name, field_type, length, decimals))
        offset += 32

    records: list[dict[str, object]] = []
    pos = header_length
    for _ in range(num_records):
        row = data[pos + 1 : pos + record_length]  # skip the deletion flag byte
        record: dict[str, object] = {}
        o = 0
        for field in fields:
            text = row[o : o + field.length].decode("latin-1").strip()
            if field.type == "N":
                record[field.name] = float(text) if text else None
            elif field.type == "L":
                record[field.name] = text.upper() == "T"
            else:
                record[field.name] = text
            o += field.length
        records.append(record)
        pos += record_length
    return fields, records


# --- .shp geometry parsing + Albers reprojection ----------------------------


def parse_prj(wkt: str) -> dict:
    """Reads the ellipsoid and (if present) Albers projection parameters
    straight out of a .prj's WKT, rather than assuming/hardcoding a
    specific EPSG code -- this is what makes reproject_point() below work
    for whatever the actual source file turns out to be.
    """

    def param(name: str) -> float | None:
        m = re.search(rf'PARAMETER\["{name}",([-\d.eE]+)\]', wkt)
        return float(m.group(1)) if m else None

    spheroid = re.search(r'SPHEROID\["[^"]*",([-\d.eE]+),([-\d.eE]+)\]', wkt)
    if not spheroid:
        raise SystemExit(f"Couldn't find an ellipsoid in this .prj: {wkt!r}")
    a = float(spheroid.group(1))
    inv_f = float(spheroid.group(2))
    if inv_f == 0:
        raise SystemExit(
            "This .prj uses a perfect sphere, not an ellipsoid -- "
            "this script's reprojection only supports ellipsoidal sources."
        )
    e2 = 2 / inv_f - 1 / inv_f**2
    e = math.sqrt(e2)

    if "PROJCS" not in wkt:
        return {"kind": "geographic", "a": a, "e": e}

    projection = re.search(r'PROJECTION\["([^"]+)"\]', wkt)
    if not projection or projection.group(1) != "Albers":
        name = projection.group(1) if projection else "unknown"
        raise SystemExit(
            f"This script's reprojection only supports Albers-projected or "
            f"plain geographic sources; this .prj uses '{name}'."
        )
    return {
        "kind": "albers",
        "a": a,
        "e": e,
        "lon0": math.radians(param("Central_Meridian")),
        "phi1": math.radians(param("Standard_Parallel_1")),
        "phi2": math.radians(param("Standard_Parallel_2")),
        "phi0": math.radians(param("Latitude_Of_Origin")),
        "false_e": param("False_Easting") or 0.0,
        "false_n": param("False_Northing") or 0.0,
    }


def albers_inverse(
    x: float,
    y: float,
    a: float,
    e: float,
    phi0: float,
    phi1: float,
    phi2: float,
    lon0: float,
    false_e: float = 0.0,
    false_n: float = 0.0,
) -> tuple[float, float]:
    """Ellipsoidal Albers Equal-Area Conic inverse projection (Snyder 1987,
    "Map Projections: A Working Manual", equations 14-1 through 14-4 and
    the iterative latitude solution 3-16). Verified against `pyproj`'s
    independent implementation of EPSG:5070 and EPSG:3338 (this
    projection's two real-world uses in this script) to 8 decimal places
    on multiple test points while writing this -- not just derived from
    the formula and trusted blind.
    """

    def m(phi: float) -> float:
        s = math.sin(phi)
        return math.cos(phi) / math.sqrt(1 - e * e * s * s)

    def q(phi: float) -> float:
        s = math.sin(phi)
        return (1 - e * e) * (
            s / (1 - e * e * s * s)
            - (1 / (2 * e)) * math.log((1 - e * s) / (1 + e * s))
        )

    m1, m2 = m(phi1), m(phi2)
    q0, q1, q2 = q(phi0), q(phi1), q(phi2)
    n = (m1 * m1 - m2 * m2) / (q2 - q1)
    C = m1 * m1 + n * q1
    rho0 = a * math.sqrt(C - n * q0) / n

    xp, yp = x - false_e, y - false_n
    rho = math.copysign(math.sqrt(xp * xp + (rho0 - yp) ** 2), n)
    theta = math.atan2(n * xp, n * (rho0 - yp)) if n != 0 else 0.0
    qp = (C - (rho * n / a) ** 2) / n

    phi = math.asin(max(-1.0, min(1.0, qp / 2)))
    for _ in range(10):
        s = math.sin(phi)
        denom = 1 - e * e * s * s
        phi_next = phi + (denom * denom / (2 * math.cos(phi))) * (
            qp / (1 - e * e)
            - s / denom
            + (1 / (2 * e)) * math.log((1 - e * s) / (1 + e * s))
        )
        if abs(phi_next - phi) < 1e-12:
            phi = phi_next
            break
        phi = phi_next

    lon = lon0 + theta / n
    return math.degrees(lon), math.degrees(phi)


def reproject_point(x: float, y: float, info: dict) -> tuple[float, float]:
    if info["kind"] == "geographic":
        return x, y
    return albers_inverse(
        x,
        y,
        info["a"],
        info["e"],
        info["phi0"],
        info["phi1"],
        info["phi2"],
        info["lon0"],
        info["false_e"],
        info["false_n"],
    )


def read_shp_records(data: bytes) -> tuple[int, list[bytes]]:
    shape_type = struct.unpack_from("<i", data, 32)[0]
    records = []
    pos = 100
    while pos < len(data):
        content_len = struct.unpack_from(">i", data, pos + 4)[0] * 2
        records.append(data[pos + 8 : pos + 8 + content_len])
        pos += 8 + content_len
    return shape_type, records


def ring_signed_area(ring: list[tuple[float, float]]) -> float:
    """Standard shoelace formula. In the shapefile spec's own (Cartesian,
    Y-up) coordinate convention, a negative result means the ring is
    wound clockwise."""
    total = 0.0
    for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
        total += x1 * y2 - x2 * y1
    return total / 2.0


def group_rings_into_polygons(
    rings: list[list[tuple[float, float]]],
) -> list[list[list[tuple[float, float]]]]:
    """Per the ESRI Shapefile spec, a Polygon record's rings aren't
    pre-grouped -- a clockwise ring starts a new polygon (its exterior
    ring), and any counterclockwise rings immediately after it are holes
    belonging to that polygon, until the next clockwise ring starts the
    next polygon. This is how a single Polygon record can represent a
    MultiPolygon (multiple disjoint exteriors) as well as a polygon with
    holes -- shpjs/GDAL do the same reconstruction internally.
    """
    polygons: list[list[list[tuple[float, float]]]] = []
    for ring in rings:
        is_exterior = ring_signed_area(ring) < 0
        if is_exterior or not polygons:
            polygons.append([ring])
        else:
            polygons[-1].append(ring)
    return polygons


def shp_record_to_geometry(content: bytes, info: dict) -> dict:
    """Converts one raw Polygon shapefile record into a GeoJSON Polygon or
    MultiPolygon geometry, reprojected to lon/lat. Ring point order is
    reversed on the way out: GeoJSON (RFC 7946) requires the opposite
    winding convention from the Shapefile spec (exterior rings
    counterclockwise, holes clockwise) -- classification above uses the
    original Shapefile-convention winding, then every ring is reversed
    afterward to satisfy both conventions at once.
    """
    shape_type = struct.unpack_from("<i", content, 0)[0]
    if shape_type != 5:
        raise SystemExit(
            f"Only Polygon shapefiles are supported (got shape type {shape_type})."
        )
    num_parts = struct.unpack_from("<i", content, 36)[0]
    num_points = struct.unpack_from("<i", content, 40)[0]
    parts_offset = 44
    points_offset = 44 + 4 * num_parts

    part_starts = [
        struct.unpack_from("<i", content, parts_offset + i * 4)[0]
        for i in range(num_parts)
    ]
    part_starts.append(num_points)

    rings: list[list[tuple[float, float]]] = []
    for i in range(num_parts):
        ring = []
        for j in range(part_starts[i], part_starts[i + 1]):
            x, y = struct.unpack_from("<2d", content, points_offset + j * 16)
            ring.append(reproject_point(x, y, info))
        rings.append(ring)

    polygons = group_rings_into_polygons(rings)
    polygons_reversed = [
        [list(reversed(ring)) for ring in polygon] for polygon in polygons
    ]

    if len(polygons_reversed) == 1:
        return {"type": "Polygon", "coordinates": polygons_reversed[0]}
    return {"type": "MultiPolygon", "coordinates": polygons_reversed}


def build_features_from_sources(
    sources: list[dict[str, bytes]],
) -> tuple[list[dict], list[DbfField]]:
    """Each source is {'.shp':..., '.dbf':..., '.prj':...} raw bytes (as
    returned by fetch_zip_members()). Parses and reprojects every source's
    geometry, and unions their attribute field lists by name (a field only
    one source has is just absent on the other source's features) -- the
    only reason --country needs more than one source at all.
    """
    features: list[dict] = []
    all_fields: dict[str, DbfField] = {}

    for source in sources:
        if ".prj" not in source:
            raise SystemExit("Missing .prj -- can't determine this file's CRS.")
        info = parse_prj(source[".prj"].decode("ascii", errors="replace"))
        shape_type, raw_records = read_shp_records(source[".shp"])
        if shape_type != 5:
            raise SystemExit(
                f"Only Polygon shapefiles are supported (got shape type {shape_type})."
            )
        fields, dbf_records = read_dbf(source[".dbf"])
        if len(dbf_records) != len(raw_records):
            raise SystemExit(
                "A source's geometry count didn't match its attribute "
                "record count -- refusing to merge misaligned data."
            )
        for field in fields:
            all_fields.setdefault(field.name, field)
        for raw, properties in zip(raw_records, dbf_records):
            features.append(
                {
                    "type": "Feature",
                    "geometry": shp_record_to_geometry(raw, info),
                    "properties": dict(properties),
                }
            )

    return features, list(all_fields.values())


# --- Styling -----------------------------------------------------------------


def default_class_color(index: int, total: int) -> str:
    """Same hue-spacing formula as paletteColors.ts's defaultClassColor()
    in this repo -- evenly spaced hues around the color wheel, so adjacent
    classes stay visually distinct regardless of how many there are.
    """
    hue = (index * 360 / total) if total > 0 else 0
    r, g, b = colorsys.hls_to_rgb(hue / 360, 0.5, 0.65)
    return "#{:02x}{:02x}{:02x}".format(
        round(r * 255), round(g * 255), round(b * 255)
    )


def find_name_field(fields: list[DbfField], level: int) -> str:
    """Picks the ecoregion-name column to color by. EPA's Level III/IV
    shapefiles use US_L3NAME/US_L4NAME in practice (confirmed against a
    real downloaded Colorado Level III shapefile while writing this), but
    this doesn't hardcode that as the only possibility -- it looks for it,
    then falls back progressively, so a shapefile that names the column
    slightly differently still works instead of crashing.
    """
    names = [f.name for f in fields if f.type == "C"]
    exact = f"US_L{level}NAME"
    if exact in names:
        return exact
    level_matches = [
        n for n in names if "NAME" in n.upper() and f"L{level}" in n.upper()
    ]
    if level_matches:
        return level_matches[0]
    name_matches = [n for n in names if "NAME" in n.upper()]
    if name_matches:
        return name_matches[0]
    raise SystemExit(
        f"Couldn't find an ecoregion name column among: {names}. "
        f"Pass a different field with --field, or check the shapefile by hand."
    )


def find_parent_name_field(fields: list[DbfField], name_field: str) -> str | None:
    """EPA's Level IV (and III) ecoregion names aren't unique on their own
    -- the same name can recur under different parent regions (e.g. two
    different "Alpine Zone" ecoregions, one nested in the "Wasatch and
    Uinta Mountains" Level III ecoregion and one in "Southern Rockies",
    confirmed against real downloaded data). The real disambiguator is the
    parent ecoregion's own name -- Level IV shapefiles carry the parent
    Level III name right alongside as its own column (US_L4NAME's file
    also has US_L3NAME; confirmed against a real downloaded Wyoming Level
    IV shapefile). This looks for that one level up generically (US_L4NAME
    -> US_L3NAME; US_L3NAME -> NA_L2NAME, since EPA's own schema switches
    from a "US_" to "NA_" prefix at that boundary -- there's no US_L2NAME
    at all), returning None if there isn't one -- coloring still works
    fine without a prefix, just with less disambiguation between
    same-named regions.
    """
    match = re.match(r"^(US|NA)_L(\d+)NAME$", name_field.upper())
    if not match or int(match.group(2)) <= 1:
        return None
    prefix, level = match.group(1), int(match.group(2))
    by_upper = {f.name.upper(): f.name for f in fields}
    same_prefix = f"{prefix}_L{level - 1}NAME"
    if same_prefix in by_upper:
        return by_upper[same_prefix]
    other_prefix = "NA" if prefix == "US" else "US"
    return by_upper.get(f"{other_prefix}_L{level - 1}NAME")


LABEL_FIELD_NAME = "ECO_LABEL"


def style_features(
    features: list[dict], name_field: str, parent_field: str | None
) -> dict[str, str]:
    """Adds ECO_LABEL ("<parent name> <name>", e.g. "Wasatch and Uinta
    Mountains Alpine Zone") plus WW_MODE/WW_FIELD/WW_COLOR to every
    feature's properties, in place. Unlike the old DBF-based version of
    this script, there's no fixed-width column to size or pad -- these are
    just plain JSON properties, added directly. Returns the
    label -> color mapping, for the printed summary.
    """
    for feature in features:
        props = feature["properties"]
        name = str(props.get(name_field, "")).strip()
        if parent_field:
            parent = str(props.get(parent_field, "")).strip()
            label = f"{parent} {name}".strip()
        else:
            label = name
        props[LABEL_FIELD_NAME] = label

    # dict preserves insertion order (Python 3.7+), so this doubles as an
    # ordered set of distinct values in first-seen order -- same
    # convention as vectorEditableMeta.ts's distinctFieldValues().
    distinct_values = list(
        dict.fromkeys(f["properties"][LABEL_FIELD_NAME] for f in features)
    )
    colors = {
        value: default_class_color(i, len(distinct_values))
        for i, value in enumerate(distinct_values)
    }
    for feature in features:
        props = feature["properties"]
        props["WW_MODE"] = "categorical"
        props["WW_FIELD"] = LABEL_FIELD_NAME
        props["WW_COLOR"] = colors[props[LABEL_FIELD_NAME]]
    return colors


# --- Fetching ----------------------------------------------------------------

NATIONAL_SHAPEFILE_URL = (
    "https://dmap-prod-oms-edc.s3.us-east-1.amazonaws.com/ORD/Ecoregions/us/us_eco_l{level}.zip"
)


def fetch_zip_members(url: str) -> dict[str, bytes]:
    """Downloads `url` and returns its contents keyed by lowercase
    extension (.shp/.shx/.dbf/.prj/.cpg -- whichever are present)."""
    zip_bytes = fetch(url)
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as archive:
        members = {Path(name).suffix.lower(): name for name in archive.namelist()}
        if ".shp" not in members or ".dbf" not in members:
            raise SystemExit(
                f"The downloaded zip doesn't look like a shapefile "
                f"(contents: {archive.namelist()})."
            )
        return {
            suffix: archive.read(name)
            for suffix, name in members.items()
            if suffix in (".shp", ".dbf", ".prj")
        }


def fetch_country_sources(level: int) -> list[dict[str, bytes]]:
    """Returns the raw {.shp, .dbf, .prj} source(s) --country needs --
    geometry parsing/reprojection and attribute merging happen later, in
    build_features_from_sources(), the same code path a single state's
    one source also goes through."""
    national_url = NATIONAL_SHAPEFILE_URL.format(level=level)
    print(f"Downloading the national (lower 48) shapefile: {national_url}")
    sources = [fetch_zip_members(national_url)]

    if level == 3:
        print("Finding Alaska's Level III shapefile (not in the national file)...")
        alaska_url = find_shapefile_url("Alaska", 3)
        print(f"Downloading: {alaska_url}")
        sources.append(fetch_zip_members(alaska_url))
    else:
        print(
            "Note: Alaska has no Level IV ecoregions available from the EPA -- "
            "this file covers the lower 48 states only."
        )
    print(
        "Note: Hawaii isn't part of the EPA's ecoregion system at all and "
        "can't be included."
    )
    return sources


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "state",
        nargs="?",
        help='US state name, e.g. "Montana" or "New York" (omit with --country)',
    )
    parser.add_argument(
        "--country",
        action="store_true",
        help="Build one merged file for the lower 48 + Alaska instead of a single state",
    )
    parser.add_argument(
        "--level",
        type=int,
        choices=(3, 4),
        default=4,
        help="EPA ecoregion level of detail (default: 4, finer/more detailed)",
    )
    parser.add_argument(
        "--field",
        help="Attribute field to color by (default: auto-detected, e.g. US_L4NAME)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Output .geojson file path (default: ./<state>_ecoregions_l<level>.geojson)",
    )
    args = parser.parse_args()

    if args.country and args.state:
        raise SystemExit("Pass either a state name or --country, not both.")
    if not args.country and not args.state:
        raise SystemExit("Pass a state name, or --country for the whole country.")

    if args.country:
        sources = fetch_country_sources(args.level)
        default_output = Path(f"united_states_ecoregions_l{args.level}.geojson")
    else:
        state_name = resolve_state_name(args.state)
        print(
            f"Looking for {state_name}'s Level {args.level} ecoregions across "
            f"EPA regions 1-{NUM_EPA_REGIONS}..."
        )
        shapefile_url = find_shapefile_url(state_name, args.level)
        print(f"Found: {shapefile_url}")
        print("Downloading...")
        sources = [fetch_zip_members(shapefile_url)]
        default_output = Path(
            f"{state_name.lower().replace(' ', '_')}_ecoregions_l{args.level}.geojson"
        )

    print("Parsing geometry and reprojecting to WGS84 (this is the slow part)...")
    features, fields = build_features_from_sources(sources)

    name_field = args.field or find_name_field(fields, args.level)
    parent_field = find_parent_name_field(fields, name_field)
    if parent_field:
        print(
            f"Coloring by: {name_field}, prefixed with its {parent_field} parent "
            f'(e.g. "Wasatch and Uinta Mountains Alpine Zone")'
        )
    else:
        print(f"Coloring by: {name_field}")
    colors = style_features(features, name_field, parent_field)

    output_path = args.output or default_output
    output_path.parent.mkdir(parents=True, exist_ok=True)
    geojson = {"type": "FeatureCollection", "features": features}
    output_path.write_text(json.dumps(geojson, separators=(",", ":")))

    print(f"\n{len(colors)} ecoregion(s) found:")
    for value, color in colors.items():
        print(f"  {color}  {value}")
    print(f"\nWrote {output_path} -- drop it into /gis-editor.")


if __name__ == "__main__":
    main()
