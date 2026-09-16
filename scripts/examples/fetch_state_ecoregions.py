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
    Standard library only (urllib, zipfile, zlib, struct, re, colorsys,
    math, json, ...) -- no `pip install` needed. The Shapefile binary formats
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
import zlib
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
        html = _get_region_html(region)
        if not html:
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
    features: list[dict],
    name_field: str,
    parent_field: str | None,
    code_field: str | None = None,
    poster_colors: dict[str, str] | None = None,
) -> dict[str, str]:
    """Adds ECO_LABEL ("<parent name> <name>", e.g. "Wasatch and Uinta
    Mountains Alpine Zone") plus WW_MODE/WW_FIELD/WW_COLOR to every
    feature's properties, in place. Unlike the old DBF-based version of
    this script, there's no fixed-width column to size or pad -- these are
    just plain JSON properties, added directly. Returns the
    label -> color mapping, for the printed summary.

    If `poster_colors` (a code -> "#rrggbb" mapping, see fetch_poster_colors())
    is given, a feature's own `code_field` value (e.g. US_L4CODE "19b") is
    looked up there first -- these are EPA's actual published colors, lifted
    from the state's own poster PDF legend, not invented. Any code missing
    from `poster_colors` (including everything, if it's None -- --country
    runs don't fetch a poster at all) falls back to the same generated,
    evenly-hue-spaced palette as before, so coloring never fails outright.
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

    # First choice: the real EPA poster color, found via this label's code.
    colors: dict[str, str] = {}
    if poster_colors and code_field:
        label_to_code = {
            f["properties"][LABEL_FIELD_NAME]: str(
                f["properties"].get(code_field, "")
            ).strip()
            for f in features
        }
        for value in distinct_values:
            code = label_to_code.get(value, "")
            if code in poster_colors:
                colors[value] = poster_colors[code]

    # Fallback: the generated palette, for anything not matched above (or
    # everything, if poster_colors wasn't available at all).
    unmatched = [value for value in distinct_values if value not in colors]
    for i, value in enumerate(unmatched):
        colors[value] = default_class_color(i, len(unmatched))

    for feature in features:
        props = feature["properties"]
        props["WW_MODE"] = "categorical"
        props["WW_FIELD"] = LABEL_FIELD_NAME
        props["WW_COLOR"] = colors[props[LABEL_FIELD_NAME]]
    return colors


# --- Poster legend colors (optional, best-effort) ---------------------------
#
# EPA's own state "poster front side" PDFs (e.g. ut_front.pdf) draw a real
# vector legend: a small flat-filled swatch next to each ecoregion code and
# name. Those are the actual, official, hand-chosen colors used in EPA's own
# cartography (grouped by parent region with related shades -- nothing like
# the generated rainbow above) -- but they're not exposed anywhere in the
# shapefile's own attribute data, only in this PDF's vector artwork. This
# section is a from-scratch, stdlib-only PDF content-stream reader (just
# enough of one: FlateDecode streams, text-showing and path-fill operators)
# that finds each legend row's swatch fill color and the code/name text next
# to it, matched by position. Everything here is best-effort: if a state's
# poster doesn't parse the way Utah's did (older scan, different software
# version, whatever), fetch_poster_colors() catches it and returns None --
# style_features() already falls back to the generated palette in that case,
# so this can never turn into a hard failure of the whole script.
#
# CMYK -> RGB: EPA's posters fill paths using CMYK ('k'/'K' operators) under
# a specific embedded ICC profile (confirmed: "U.S. Web Coated (SWOP) v2",
# referenced from the page's /Resources as /DefaultCMYK), not naive device
# CMYK -- a plain (1-C)(1-K) formula visibly drifts from how any real PDF
# viewer renders these fills (verified against both Pillow/LittleCMS and a
# poppler-rendered raster while writing this: naive formula on one swatch
# gave (59,181,148) against a true rendered (60,146,150) -- a real, visible
# difference in saturation). _eval_lut16()/_cmyk_to_srgb_icc() below are a
# from-scratch reader for the ICC 'mft2' (lut16Type) tag format the embedded
# profile uses (ICC.1:2001-04 spec, section 6.5.7) plus the standard
# Lab->XYZ (D50)->Bradford-adapt->linear sRGB->gamma pipeline -- verified
# against both Pillow/LittleCMS and the poppler raster to within 1-3/255 on
# multiple real swatches, close enough to call it correct.


def _pdf_find_object(data: bytes, num: int) -> bytes:
    match = re.search((r"(?:^|[^0-9])%d\s+0\s+obj" % num).encode(), data)
    if not match:
        raise ValueError(f"PDF object {num} 0 obj not found")
    end = data.find(b"endobj", match.end())
    return data[match.end() : end]


def _pdf_decode_stream(raw: bytes) -> bytes:
    start = raw.find(b"stream")
    start = raw.index(b"\n", start) + 1
    end = raw.find(b"endstream")
    stream_bytes = raw[start:end].rstrip(b"\r\n")
    if b"/FlateDecode" in raw[: raw.find(b"stream")]:
        return zlib.decompress(stream_bytes)
    return stream_bytes


def _pdf_extract_page_content_and_icc(pdf_bytes: bytes) -> tuple[bytes, bytes | None]:
    """Returns (decoded content stream bytes of the first /Type /Page,
    embedded ICC profile bytes if its /Resources declare a /DefaultCMYK
    ICCBased color space, else None)."""
    page_match = re.search(rb"/Type\s*/Page[^s]", pdf_bytes)
    if not page_match:
        raise ValueError("no /Type /Page found")
    # /Type /Page appears INSIDE the page dict, not at its opening '<<' --
    # find that first, then walk depth forward from there (not from
    # page_match itself) so nested dicts (/Resources, /PieceInfo, ...)
    # don't cause the closing '>>' of one of *those* to be mistaken for the
    # page dict's own close.
    page_dict_start = pdf_bytes.rfind(b"<<", 0, page_match.start())
    depth = 0
    pos = page_dict_start
    while True:
        open_i = pdf_bytes.find(b"<<", pos)
        close_i = pdf_bytes.find(b">>", pos)
        if open_i != -1 and open_i < close_i:
            depth += 1
            pos = open_i + 2
        else:
            depth -= 1
            pos = close_i + 2
            if depth == 0:
                page_dict_end = close_i
                break
    page_dict = pdf_bytes[page_dict_start:page_dict_end]

    contents_match = re.search(rb"/Contents\s+(\d+)\s+0\s+R", page_dict)
    content_bytes = b""
    if contents_match:
        num = int(contents_match.group(1))
        content_bytes = _pdf_decode_stream(_pdf_find_object(pdf_bytes, num))
    else:
        array_match = re.search(rb"/Contents\s*\[([^\]]+)\]", page_dict)
        if array_match:
            for num_str in re.findall(rb"(\d+)\s+0\s+R", array_match.group(1)):
                content_bytes += _pdf_decode_stream(
                    _pdf_find_object(pdf_bytes, int(num_str))
                )
    if not content_bytes:
        raise ValueError("page has no /Contents")

    icc_bytes = None
    default_cmyk_match = re.search(rb"/DefaultCMYK\s+(\d+)\s+0\s+R", page_dict)
    if default_cmyk_match:
        try:
            arr = _pdf_find_object(pdf_bytes, int(default_cmyk_match.group(1)))
            iccbased_match = re.search(rb"/ICCBased\s+(\d+)\s+0\s+R", arr)
            if iccbased_match:
                icc_bytes = _pdf_decode_stream(
                    _pdf_find_object(pdf_bytes, int(iccbased_match.group(1)))
                )
        except Exception:  # noqa: BLE001 -- ICC is an accuracy nicety, not required
            icc_bytes = None
    return content_bytes, icc_bytes


_PDF_TOKEN_RE = re.compile(
    rb"""
      \( (?P<str> (?:[^()\\]|\\.)* ) \)
    | (?P<num> [+-]?\d*\.\d+ | [+-]?\d+)
    | (?P<op> [A-Za-z*'"]+)
""",
    re.X | re.S,
)


def _parse_pdf_content(content: bytes) -> tuple[list[tuple[float, float, str]], list]:
    """A from-scratch, minimal PDF content-stream interpreter -- just the
    handful of operators a flat-colored vector legend + positioned text
    actually uses (path construction/fill, CMYK/gray fill color, and
    text-positioning/showing). Returns (text runs, fills):
      text runs: (x, y, text) -- one per BT...ET block. Each glyph in these
        posters is usually its own Tj call (sometimes several per block,
        continuing the same visual line via Td) -- concatenating everything
        between BT and ET (or a real line-wrapping Td) reconstructs each
        legend row's text without needing per-glyph width tables at all,
        since we only need the whole line, not exact per-character x.
      fills: (xmin, ymin, xmax, ymax, (r, g, b) 0..1) -- one per path fill.
    """
    fill_rgb = (0.0, 0.0, 0.0)
    tm = (1.0, 0.0, 0.0, 1.0, 0.0, 0.0)
    cur_path: list[tuple[float, float]] = []
    all_subpaths: list[list[tuple[float, float]]] = []
    start_xy = (0.0, 0.0)
    text_runs: list[tuple[float, float, str]] = []
    fills: list[tuple[float, float, float, float, tuple[float, float, float]]] = []
    block_start_xy: tuple[float, float] | None = None
    block_chars: list[str] = []

    def flush_block():
        nonlocal block_start_xy, block_chars
        if block_start_xy is not None and block_chars:
            text_runs.append((block_start_xy[0], block_start_xy[1], "".join(block_chars)))
        block_start_xy, block_chars = None, []

    operands: list[tuple[str, object]] = []
    for m in _PDF_TOKEN_RE.finditer(content):
        if m.lastgroup == "str":
            raw = m.group("str")
            out = bytearray()
            i = 0
            escapes = {0x6E: 10, 0x72: 13, 0x74: 9, 0x62: 8, 0x66: 12, 0x28: 40, 0x29: 41, 0x5C: 92}
            while i < len(raw):
                c = raw[i]
                if c == 0x5C and i + 1 < len(raw) and raw[i + 1] in escapes:
                    out.append(escapes[raw[i + 1]])
                    i += 2
                    continue
                if c == 0x5C:
                    i += 2
                    continue
                out.append(c)
                i += 1
            operands.append(("str", bytes(out).decode("latin-1")))
            continue
        if m.lastgroup == "num":
            operands.append(("num", float(m.group("num"))))
            continue
        op = m.group("op").decode()
        nums = [v for (t, v) in operands if t == "num"]
        strs = [v for (t, v) in operands if t == "str"]

        if op == "BT":
            block_start_xy, block_chars = None, []
        elif op == "ET":
            flush_block()
        elif op == "Tm" and len(nums) >= 6:
            tm = tuple(nums[-6:])
            if block_chars:
                flush_block()
            block_start_xy = (tm[4], tm[5])
        elif op in ("Td", "TD") and len(nums) >= 2:
            a, b, c, d, e, f = tm
            tx, ty = nums[-2:]
            tm = (a, b, c, d, e + tx * a + ty * c, f + tx * b + ty * d)
            if block_start_xy is None:
                block_start_xy = (tm[4], tm[5])
            elif abs(ty) > 0.3:
                flush_block()
                block_start_xy = (tm[4], tm[5])
        elif op == "T*":
            flush_block()
            block_start_xy = (tm[4], tm[5])
        elif op in ("Tj", "'", '"') and strs:
            if block_start_xy is None:
                block_start_xy = (tm[4], tm[5])
            block_chars.append(strs[-1])
        elif op == "g" and nums:
            gray = nums[-1]
            fill_rgb = (gray, gray, gray)
        elif op == "rg" and len(nums) >= 3:
            fill_rgb = tuple(nums[-3:])
        elif op == "k" and len(nums) >= 4:
            c_, m_, y_, k_ = nums[-4:]
            fill_rgb = ("cmyk", c_, m_, y_, k_)
        elif op == "m" and len(nums) >= 2:
            if cur_path:
                all_subpaths.append(cur_path)
            cur_path = [tuple(nums[-2:])]
            start_xy = cur_path[0]
        elif op == "l" and len(nums) >= 2:
            cur_path.append(tuple(nums[-2:]))
        elif op in ("c", "v", "y") and len(nums) >= 2:
            cur_path.append(tuple(nums[-2:]))
        elif op == "h" and cur_path:
            cur_path.append(start_xy)
        elif op in ("f", "F", "f*", "B", "B*", "b", "b*"):
            if cur_path:
                all_subpaths.append(cur_path)
            for pts in all_subpaths:
                xs = [p[0] for p in pts]
                ys = [p[1] for p in pts]
                fills.append((min(xs), min(ys), max(xs), max(ys), fill_rgb))
            all_subpaths, cur_path = [], []
        elif op == "n":
            all_subpaths, cur_path = [], []
        operands = []
    return text_runs, fills


# --- ICC profile ('mft2'/lut16Type) CMYK -> sRGB, pure Python ---------------


def _s15f16(raw: bytes) -> float:
    return struct.unpack(">i", raw)[0] / 65536.0


def _parse_icc_lut16(tag_bytes: bytes) -> dict:
    if tag_bytes[0:4] != b"mft2":
        raise ValueError("expected an 'mft2' (lut16Type) ICC tag")
    in_ch, out_ch, grid = tag_bytes[8], tag_bytes[9], tag_bytes[10]
    offset = 12 + 9 * 4  # skip the (unused, input!=3) 3x3 matrix
    n_in, n_out = struct.unpack(">HH", tag_bytes[offset : offset + 4])
    offset += 4
    input_tables = []
    for _ in range(in_ch):
        input_tables.append(
            struct.unpack(">%dH" % n_in, tag_bytes[offset : offset + 2 * n_in])
        )
        offset += 2 * n_in
    clut_count = grid**in_ch
    clut = struct.unpack(
        ">%dH" % (clut_count * out_ch),
        tag_bytes[offset : offset + 2 * clut_count * out_ch],
    )
    offset += 2 * clut_count * out_ch
    output_tables = []
    for _ in range(out_ch):
        output_tables.append(
            struct.unpack(">%dH" % n_out, tag_bytes[offset : offset + 2 * n_out])
        )
        offset += 2 * n_out
    return {
        "in_ch": in_ch,
        "out_ch": out_ch,
        "grid": grid,
        "input_tables": input_tables,
        "clut": clut,
        "output_tables": output_tables,
    }


def _lerp1d(table: tuple[int, ...], x: float) -> float:
    pos = x * (len(table) - 1)
    i0 = int(pos)
    i1 = min(i0 + 1, len(table) - 1)
    frac = pos - i0
    return (table[i0] * (1 - frac) + table[i1] * frac) / 65535.0


def _eval_icc_lut16(lut: dict, inputs: tuple[float, ...]) -> list[float]:
    in_ch, out_ch, grid, clut = lut["in_ch"], lut["out_ch"], lut["grid"], lut["clut"]
    coords = [_lerp1d(lut["input_tables"][c], inputs[c]) for c in range(in_ch)]
    scaled = [c * (grid - 1) for c in coords]
    idx0 = [min(int(s), grid - 2) for s in scaled]
    frac = [scaled[d] - idx0[d] for d in range(in_ch)]

    def clut_at(indices: list[int]) -> tuple[int, ...]:
        flat = 0
        for d in range(in_ch):
            flat = flat * grid + indices[d]
        base = flat * out_ch
        return clut[base : base + out_ch]

    out = [0.0] * out_ch
    for corner in range(1 << in_ch):
        indices, weight = [], 1.0
        for d in range(in_ch):
            bit = (corner >> d) & 1
            indices.append(idx0[d] + bit)
            weight *= frac[d] if bit else (1 - frac[d])
        if weight == 0:
            continue
        vals = clut_at(indices)
        for o in range(out_ch):
            out[o] += weight * vals[o]
    return [_lerp1d(lut["output_tables"][o], out[o] / 65535.0) for o in range(out_ch)]


def _lab_to_xyz_d50(l_star: float, a_star: float, b_star: float) -> tuple[float, float, float]:
    fy = (l_star + 16) / 116
    fx = fy + a_star / 500
    fz = fy - b_star / 200

    def finv(t: float) -> float:
        return t**3 if t**3 > 0.008856 else (t - 16 / 116) / 7.787

    xn, yn, zn = 0.9642, 1.0, 0.8249  # D50 reference white
    return finv(fx) * xn, finv(fy) * yn, finv(fz) * zn


def _xyz_d50_to_srgb(x: float, y: float, z: float) -> tuple[int, int, int]:
    # Bradford chromatic adaptation D50 -> D65, then the standard linear
    # XYZ(D65) -> linear sRGB matrix, then sRGB's gamma encoding.
    xd = 0.9555766 * x + -0.0230393 * y + 0.0631636 * z
    yd = -0.0282895 * x + 1.0099416 * y + 0.0210077 * z
    zd = 0.0122982 * x + -0.0204830 * y + 1.3299098 * z
    r = 3.2404542 * xd - 1.5371385 * yd - 0.4985314 * zd
    g = -0.9692660 * xd + 1.8760108 * yd + 0.0415560 * zd
    b = 0.0556434 * xd - 0.2040259 * yd + 1.0572252 * zd

    def gamma(c: float) -> float:
        c = max(0.0, min(1.0, c))
        return 12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055

    return tuple(round(max(0.0, min(1.0, gamma(c))) * 255) for c in (r, g, b))


def _cmyk_to_srgb(color, icc_lut: dict | None) -> tuple[int, int, int]:
    """`color` is either a plain (r, g, b) 0..1 tuple (from 'rg'/'g') or a
    ("cmyk", c, m, y, k) tuple (from 'k'). Uses the real embedded ICC
    profile when available (see the module docstring above this section for
    why that matters); falls back to the naive (1-C)(1-K) formula
    otherwise -- visibly less accurate, but still much closer to the real
    printed colors than not using CMYK at all.

    Always the swatch's raw, fully-opaque ink color: `_parse_pdf_content()`
    only ever records the fill-color operator ('k'/'g'/'rg') immediately
    behind a path fill, never any `gs`-set /ca /CA alpha -- confirmed
    against Utah's own poster, whose ExtGState objects only set overprint
    flags (/OP /op /OPM), not alpha, but this holds regardless of what a
    given state's poster does with transparency, since alpha is never read
    here at all.
    """
    if color[0] != "cmyk":
        r, g, b = color
        return tuple(round(max(0.0, min(1.0, c)) * 255) for c in (r, g, b))
    _, c, m, y, k = color
    if icc_lut is not None:
        l_star, a_star, b_star = _eval_icc_lut16(icc_lut, (c, m, y, k))
        x, y_, z = _lab_to_xyz_d50(l_star * 100, a_star * 255 - 128, b_star * 255 - 128)
        return _xyz_d50_to_srgb(x, y_, z)
    r = (1 - c) * (1 - k)
    g = (1 - m) * (1 - k)
    b = (1 - y) * (1 - k)
    return tuple(round(v * 255) for v in (r, g, b))


_LEGEND_ROW_RE = re.compile(r"^(\d+[a-z]?)\s+(.*\S)\s*$")


def _match_legend_swatches(
    text_runs: list[tuple[float, float, str]],
    fills: list,
    icc_lut: dict | None,
) -> dict[str, str]:
    """For each "<code> <name>" legend row (e.g. "19b Uinta Subalpine
    Forests"), finds the small flat-fill swatch immediately to its left
    (same row, i.e. vertically aligned within a few points, and abutting
    its left edge) and returns {code: "#rrggbb"}. Layout assumptions here
    (swatch directly precedes its label, roughly 5-30pt wide/5-15pt tall)
    were derived from, and verified against, Utah's real poster -- states
    whose posters happen to lay this out differently just won't match for
    those rows, which is fine: the caller falls back to generated colors
    per-code, not all-or-nothing.
    """
    rows = []
    for x, y, text in text_runs:
        m = _LEGEND_ROW_RE.match(text.rstrip())
        if m and len(m.group(1)) <= 4:
            rows.append((x, y, m.group(1)))

    result: dict[str, str] = {}
    for x0, y0, code in rows:
        if code in result:
            continue
        best_color, best_gap = None, None
        for fx0, fy0, fx1, fy1, color in fills:
            w, h = fx1 - fx0, fy1 - fy0
            if not (5 <= w <= 30 and 5 <= h <= 15):
                continue
            if abs((fy0 + fy1) / 2 - y0) > 6:
                continue
            gap = x0 - fx1
            if not (0 <= gap <= 25):
                continue
            if best_gap is None or gap < best_gap:
                best_color, best_gap = color, gap
        if best_color is not None:
            r, g, b = _cmyk_to_srgb(best_color, icc_lut)
            result[code] = "#{:02x}{:02x}{:02x}".format(r, g, b)
    return result


_region_html_cache: dict[int, str] = {}


def _get_region_html(region: int) -> str:
    if region not in _region_html_cache:
        url = EPA_REGION_PAGE.format(n=region)
        try:
            _region_html_cache[region] = fetch(url).decode("utf-8", errors="replace")
        except Exception as error:  # noqa: BLE001 - report and keep going
            print(f"  (couldn't check region {region}: {error})", file=sys.stderr)
            _region_html_cache[region] = ""
    return _region_html_cache[region]


# Anchor text isn't always plain text -- e.g. Utah's own poster-front link
# is `...poster&nbsp;<strong>front</strong>&nbsp;side...`, with "front"
# nested inside a <strong> tag. `(.*?)` (DOTALL) plus stripping tags out of
# the captured group afterwards (see find_poster_pdf_url()) handles that,
# where a naive "no '<' allowed inside the anchor" pattern would silently
# cut the text off before "front" and misclassify the link.
_PDF_LINK_RE = re.compile(
    r'<a\s+href="([^"]+\.pdf)"[^>]*>(.*?)</a>', re.IGNORECASE | re.S
)
_TAG_RE = re.compile(r"<[^>]+>")


def find_poster_pdf_url(state_name: str) -> str | None:
    """Finds the state's poster PDF -- the one with the real vector legend
    (e.g. ut_front.pdf, "poster front side"). Falls back to a plain
    "Level III and IV Ecoregions of <state>" map PDF (no explicit
    front/back split -- some smaller states only publish one) if there's no
    poster; returns None if neither exists so the caller can skip poster
    coloring for that state without failing the whole run."""
    front_candidates, plain_candidates = [], []
    for region in range(1, NUM_EPA_REGIONS + 1):
        html = _get_region_html(region)
        if not html:
            continue
        for heading, body in iter_state_sections(html):
            if heading.lower() != state_name.lower():
                continue
            for href, raw_text in _PDF_LINK_RE.findall(body):
                lowered = _TAG_RE.sub("", raw_text).lower()
                if "poster" in lowered and "front" in lowered:
                    front_candidates.append(href)
                elif "ecoregions of" in lowered:
                    plain_candidates.append(href)
    if front_candidates:
        return front_candidates[0]
    if plain_candidates:
        return plain_candidates[0]
    return None


def fetch_poster_colors(state_name: str) -> dict[str, str] | None:
    """Best-effort: downloads the state's poster PDF and extracts its real
    legend colors as {code: "#rrggbb"} (e.g. {"19b": "#3a9296", ...}).
    Returns None on any failure (missing poster, unexpected PDF structure,
    no legend rows matched, ...) -- this is an enhancement over the
    generated palette, never a requirement for the script to work."""
    try:
        url = find_poster_pdf_url(state_name)
        if not url:
            return None
        print(f"Found a poster with a real legend: {url}")
        print("Downloading and reading its legend colors...")
        pdf_bytes = fetch(url)
        content, icc_bytes = _pdf_extract_page_content_and_icc(pdf_bytes)
        icc_lut = _parse_icc_lut16(_find_a2b0_tag(icc_bytes)) if icc_bytes else None
        text_runs, fills = _parse_pdf_content(content)
        colors = _match_legend_swatches(text_runs, fills, icc_lut)
        if not colors:
            print("  (couldn't match any legend rows -- using generated colors instead)")
            return None
        print(f"  Matched {len(colors)} real EPA legend colors.")
        return colors
    except Exception as error:  # noqa: BLE001 - this is a best-effort enhancement
        print(f"  (couldn't read real colors from the poster: {error} -- using generated colors instead)")
        return None


def _find_a2b0_tag(icc_bytes: bytes) -> bytes:
    tag_count = struct.unpack(">I", icc_bytes[128:132])[0]
    for i in range(tag_count):
        offset = 132 + i * 12
        sig, tag_offset, tag_size = struct.unpack(">4sII", icc_bytes[offset : offset + 12])
        if sig == b"A2B0":
            return icc_bytes[tag_offset : tag_offset + tag_size]
    raise ValueError("ICC profile has no A2B0 tag")


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

    poster_colors: dict[str, str] | None = None
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
        # Best-effort: real EPA colors from the state's own poster PDF (see
        # the "Poster legend colors" section above) -- --country skips this
        # since there's no single poster covering the whole merged file.
        poster_colors = fetch_poster_colors(state_name)

    print("Parsing geometry and reprojecting to WGS84 (this is the slow part)...")
    features, fields = build_features_from_sources(sources)

    name_field = args.field or find_name_field(fields, args.level)
    parent_field = find_parent_name_field(fields, name_field)
    code_field = name_field.replace("NAME", "CODE")
    if code_field not in {f.name for f in fields}:
        code_field = None
    if parent_field:
        print(
            f"Coloring by: {name_field}, prefixed with its {parent_field} parent "
            f'(e.g. "Wasatch and Uinta Mountains Alpine Zone")'
        )
    else:
        print(f"Coloring by: {name_field}")
    colors = style_features(features, name_field, parent_field, code_field, poster_colors)

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
