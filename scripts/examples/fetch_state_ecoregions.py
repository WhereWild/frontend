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
    4. Adds four properties to every feature: WW_MODE, WW_FIELD, WW_COLOR,
       and WW_NAME (the layer's Display Name, e.g. "Utah Level IV
       Ecoregions", or "Level IV Ecoregions" with --country).
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

    Real EPA colors (see fetch_all_lyr_colors() below) have no single
    "national .lyr" to read them from -- unlike a single state run,
    `--country` finds and reads every state's own .lyr symbology file and
    merges their {code: color} results (the same EPA code always gets the
    same official color regardless of which state's .lyr it's read from),
    so this covers every code in the merged national file at the cost of
    several dozen extra downloads -- the slowest part of a --country run.

WHY NO THIRD-PARTY DEPENDENCIES
    Standard library only (urllib, zipfile, struct, re, colorsys, math,
    json, ...) -- no `pip install` needed. The Shapefile binary formats
    (.shp geometry, .dbf attributes) and the ArcGIS .lyr symbology format
    (an MS-CFB container -- itself a public spec -- wrapping ArcObjects'
    own undocumented binary object serialization; see the ".lyr symbology
    reading" section below for how that part was figured out) are read
    directly, from scratch; this doubles as a from-scratch reference for
    all of it, and for the Albers math, without pulling in
    pyshp/pyproj/GDAL/olefile.

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
from typing import Callable
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
    # A handful of anchor hrefs on the EPA's own site are protocol-relative
    # (e.g. Florida's own shapefile link: "//dmap-...s3.../fl_eco_l4.zip",
    # confirmed while writing this) -- urlopen has no default scheme to
    # fall back on for those, so it fails with "unknown url type" outright.
    # Every host this script ever fetches from is HTTPS-only, so filling in
    # the scheme here is always correct, not a guess.
    if url.startswith("//"):
        url = "https:" + url
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


def _zip_links_by_state_name_prefix(html: str, state_name: str) -> list[tuple[str, str]]:
    """Finds .zip links anywhere on the page whose own anchor text starts
    with the state's name (e.g. "Virginia Shapefile (1.6 mb)") -- a
    fallback for EPA region pages that bundle several states under one
    combined heading instead of giving each its own (confirmed: Region 3's
    page has a single "Region 3" heading covering Delaware, Maryland,
    Pennsylvania, Virginia, and West Virginia together, so
    iter_state_sections() never yields a per-state section for any of them
    at all -- their anchor text is the only remaining way to tell them
    apart). A prefix match (not "contains") is required so "West Virginia
    Shapefile" doesn't get mistaken for "Virginia"'s own link.
    """
    pattern = re.compile(
        r'<a\s+href="([^"]+\.zip)"[^>]*>(' + re.escape(state_name) + r"\b[^<]*)</a>",
        re.IGNORECASE,
    )
    return pattern.findall(html)


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
        # Fallback for pages that bundle multiple states under one shared
        # heading (see _zip_links_by_state_name_prefix's doc comment) --
        # only adds candidates the heading-based pass above didn't already
        # find, so this is a no-op on every normal per-state-heading page.
        for href, text in _zip_links_by_state_name_prefix(html, state_name):
            if (href, text) not in candidates:
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


ROMAN_LEVELS = {3: "III", 4: "IV"}


def display_name_for(level: int, state_name: str | None) -> str:
    """The layer's Display Name (WW_NAME, see style_features): "Utah Level
    IV Ecoregions" for one state, or just "Level IV Ecoregions" for the
    merged --country file, where a state name would be wrong."""
    prefix = f"{state_name} " if state_name else ""
    return f"{prefix}Level {ROMAN_LEVELS.get(level, level)} Ecoregions"


def style_features(
    features: list[dict],
    name_field: str,
    parent_field: str | None,
    code_field: str | None = None,
    poster_colors: dict[str, str] | None = None,
    display_name: str | None = None,
) -> dict[str, str]:
    """Adds ECO_LABEL ("<parent name> <name>", e.g. "Wasatch and Uinta
    Mountains Alpine Zone") plus WW_MODE/WW_FIELD/WW_COLOR to every
    feature's properties, in place -- and WW_NAME, the layer's Display Name
    in /gis-editor and the variable's label once used as a custom layer,
    when `display_name` is given. Unlike the old DBF-based version of
    this script, there's no fixed-width column to size or pad -- these are
    just plain JSON properties, added directly. Returns the
    label -> color mapping, for the printed summary.

    If `poster_colors` (a code -> "#rrggbb" mapping, see
    fetch_lyr_colors_for_state()) is given, a feature's own `code_field`
    value (e.g. US_L4CODE "19b") is looked up there first -- these are
    EPA's actual published colors, lifted from the state's own .lyr
    symbology file, not invented. Any code missing from `poster_colors`
    (including everything, if it's None) falls back to the same generated,
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
        if display_name:
            props["WW_NAME"] = display_name
    return colors


# --- .lyr symbology reading (real, official EPA colors) ---------------------
#
# EPA publishes a ready-to-use ArcGIS ".lyr" symbology file alongside every
# state's shapefile (e.g. ut_eco_l3.lyr, "Level III Symbology" on the EPA's
# own download page) -- the SAME official, hand-chosen colors a poster PDF
# would only let us reconstruct optically, but here stored as actual data.
# Reading it is far more robust than reading a rendered poster: no swatch
# hunting, no column-matching guesswork, no scanned-raster dead ends (New
# England's and Tennessee's own posters turned out to be scanned images with
# no vector legend to read at all -- their .lyr files are ordinary data).
#
# WHAT'S IN A .LYR FILE
#   A .lyr file is a Microsoft Compound File Binary (MS-CFB) container -- a
#   public, Microsoft-published spec, and the same container format
#   historically used by .doc/.xls -- holding one "Layer" stream (see
#   _read_cfb_stream below). That stream is ArcGIS's own undocumented,
#   proprietary binary serialization of the layer's renderer and symbology,
#   via ArcObjects' internal IPersistStream COM protocol: a graph of typed
#   objects, each tagged by a 16-byte CLSID, most also carrying their own
#   incrementing reference id (so the same object can be reused later in the
#   stream without re-serializing it) and a 2-byte format version, followed
#   by that class's own fixed sequence of fields -- more nested objects,
#   length-prefixed UTF-16 strings, or plain numbers.
#
# HOW THE FORMAT BELOW WAS FIGURED OUT
#   ESRI publishes no spec for any of this. The class GUIDs, field order,
#   and the ESRI-specific CIELab->RGB conversion constants below were
#   determined by reading (NOT copying -- this is an independent,
#   from-scratch reimplementation) the north-road/slyr project
#   (https://github.com/north-road/slyr), an open-source QGIS plugin that
#   reverse-engineered this exact format for ArcGIS-to-QGIS interoperability.
#   Its own `parser` subfolder (where this format-decoding logic lives)
#   carries no explicit license of its own -- the repo's top-level LICENSE
#   file (GPLv2) explicitly excludes that subfolder, and per the
#   maintainer's own comment on github.com/north-road/slyr/issues/41, the
#   intent was to license it "ultra permissive" but that was never
#   formalized into a declared license for it. Facts about a file format
#   (class identifiers, field order, numeric constants) aren't protectable
#   expression regardless of that -- the same footing as reverse-engineering
#   any other undocumented interop format -- but no code from that project
#   is used here; every line below is an independent implementation of the
#   facts it exposed. Cross-checked against Utah's own already-verified
#   (from this script's earlier PDF-poster-reading approach, since replaced
#   by this) colors for codes 18/19/20/21/80: every one of this reader's
#   .lyr-derived colors matched, or came within normal CMYK-conversion
#   rounding of, the PDF-derived value for the same code.
#
# CMYK -> RGB: a plain naive (1-C)(1-K) formula, not the ICC-corrected
# pipeline the old PDF-reading approach used (see this file's git history)
# -- .lyr's CmykColor objects carry no embedded color profile of their own
# to correct against, and (confirmed while switching to this approach) at
# least one state's own poster PDF (New England's shared one) has no
# embedded ICC profile either, so there's no consistent source to pull a
# real profile from without depending on a PDF fetch again, defeating the
# point of moving off PDF. This is a known, bounded accuracy tradeoff (a
# real but visually minor drift in printed-color fidelity), not a
# wrong-code/wrong-color association bug -- which is what actually made the
# old PDF approach unreliable.


def _read_cfb_stream(data: bytes, stream_name: str) -> bytes:
    """Extracts one named stream's raw bytes from an MS-CFB (Compound File
    Binary) container -- see MS-CFB, a public Microsoft spec. Handles both
    regular-FAT streams and the "mini stream" (streams under the format's
    mini_stream_cutoff, packed into small mini-sectors indexed by their own
    separate mini-FAT chain -- most .lyr streams other than "Layer" itself
    are small enough to need this)."""
    if data[:8] != b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1":
        raise ValueError("not an MS-CFB (OLE2 compound file) container")

    sector_shift = struct.unpack_from("<H", data, 30)[0]
    sector_size = 1 << sector_shift
    mini_sector_shift = struct.unpack_from("<H", data, 32)[0]
    mini_sector_size = 1 << mini_sector_shift
    num_fat_sectors = struct.unpack_from("<I", data, 44)[0]
    first_dir_sector = struct.unpack_from("<i", data, 48)[0]
    mini_stream_cutoff = struct.unpack_from("<I", data, 56)[0]
    first_minifat_sector = struct.unpack_from("<i", data, 60)[0]
    num_minifat_sectors = struct.unpack_from("<I", data, 64)[0]
    first_difat_sector = struct.unpack_from("<i", data, 68)[0]

    def sector_bytes(sec: int) -> bytes:
        off = 512 + sec * sector_size  # the header itself is always 512 bytes
        return data[off : off + sector_size]

    # The FAT's own sector list: the first 109 entries live in the header;
    # any more come from a chain of DIFAT sectors (not needed for a file
    # this small, but cheap to support for robustness).
    fat_sector_nums = list(struct.unpack_from("<109i", data, 76))
    difat_sec = first_difat_sector
    while difat_sec >= 0:
        sec_data = sector_bytes(difat_sec)
        per_sector = sector_size // 4 - 1
        fat_sector_nums.extend(struct.unpack_from(f"<{per_sector}i", sec_data, 0))
        difat_sec = struct.unpack_from("<i", sec_data, sector_size - 4)[0]
    fat_sector_nums = [s for s in fat_sector_nums if s >= 0][:num_fat_sectors]

    fat: list[int] = []
    for sec in fat_sector_nums:
        per_sector = sector_size // 4
        fat.extend(struct.unpack_from(f"<{per_sector}i", sector_bytes(sec), 0))

    def read_fat_chain(start_sec: int) -> bytes:
        out = bytearray()
        sec = start_sec
        seen = set()
        while sec >= 0:
            if sec in seen:
                raise ValueError("cyclic FAT chain")
            seen.add(sec)
            out += sector_bytes(sec)
            sec = fat[sec]
        return bytes(out)

    # The directory (one 128-byte entry per stream/storage) is itself just
    # a regular FAT-chained stream, starting at first_dir_sector.
    dir_bytes = read_fat_chain(first_dir_sector)
    entries = []
    for i in range(0, len(dir_bytes), 128):
        entry = dir_bytes[i : i + 128]
        name_len = struct.unpack_from("<H", entry, 64)[0]
        if name_len < 2:
            continue
        name = entry[: name_len - 2].decode("utf-16le")
        obj_type = entry[66]  # 2 = stream, 5 = root storage
        start_sector = struct.unpack_from("<i", entry, 116)[0]
        size = struct.unpack_from("<Q", entry, 120)[0]
        entries.append((name, obj_type, start_sector, size))

    root = next((e for e in entries if e[1] == 5), None)
    if root is None:
        raise ValueError("no root storage entry")
    _, _, root_start, root_size = root
    mini_stream = read_fat_chain(root_start)[:root_size] if root_size else b""

    minifat: list[int] = []
    if num_minifat_sectors:
        minifat_bytes = read_fat_chain(first_minifat_sector)
        minifat = list(
            struct.unpack_from(f"<{len(minifat_bytes) // 4}i", minifat_bytes, 0)
        )

    def read_minifat_chain(start_sec: int, size: int) -> bytes:
        out = bytearray()
        sec = start_sec
        seen = set()
        while sec >= 0:
            if sec in seen:
                raise ValueError("cyclic mini-FAT chain")
            seen.add(sec)
            off = sec * mini_sector_size
            out += mini_stream[off : off + mini_sector_size]
            sec = minifat[sec]
        return bytes(out[:size])

    match = next((e for e in entries if e[0] == stream_name and e[1] == 2), None)
    if match is None:
        raise ValueError(f"no stream named {stream_name!r} in this .lyr file")
    _, _, start_sector, size = match
    if size < mini_stream_cutoff:
        return read_minifat_chain(start_sector, size)
    return read_fat_chain(start_sector)[:size]


class _ArcObjectStream:
    """A tiny sequential reader + object-graph cache for the "Layer"
    stream's ArcObjects IPersistStream serialization (see the module
    comment above for what this is and how it was figured out)."""

    def __init__(self, data: bytes):
        self.data = data
        self.pos = 0
        self.ref_objects: dict[int, object] = {}

    def read(self, n: int) -> bytes:
        b = self.data[self.pos : self.pos + n]
        self.pos += n
        return b

    def read_uint(self) -> int:
        return struct.unpack_from("<I", self.read(4))[0]

    def read_ushort(self) -> int:
        return struct.unpack_from("<H", self.read(2))[0]

    def read_uchar(self) -> int:
        return self.read(1)[0]

    def read_double(self) -> float:
        return struct.unpack_from("<d", self.read(8))[0]

    def read_clsid(self) -> str:
        # Microsoft's mixed-endian GUID encoding: the first three fields
        # are little-endian; the remaining 8 bytes are stored as-is.
        raw = self.read(16)
        d1, d2, d3 = struct.unpack_from("<IHH", raw, 0)
        return "{:08x}-{:04x}-{:04x}-{}-{}".format(
            d1, d2, d3, raw[8:10].hex(), raw[10:16].hex()
        )

    def read_string(self) -> str:
        length = self.read_uint()  # byte length, including a null terminator
        raw = self.read(length - 2)
        self.read(2)  # null terminator
        return raw.decode("utf-16le")

    def read_variant(self):
        """Reads one OLE Automation VARIANT -- just enough type tags to
        skip through a PropertySet's values, whose actual contents this
        script has no use for (see _read_workspace_name)."""
        vtype = self.read_ushort()
        if vtype == 8:  # VT_BSTR
            return self.read_string()
        if vtype in (3, 4):  # VT_I4 / VT_R4 (both 4 raw bytes here)
            return self.read_uint()
        if vtype == 2:  # VT_I2
            return self.read_ushort()
        if vtype in (0, 1):  # VT_EMPTY / VT_NULL
            return None
        if vtype == 5:  # VT_R8
            return self.read_double()
        if vtype == 11:  # VT_BOOL
            return self.read_ushort() != 0
        if vtype == 7:  # VT_DATE
            return self.read_double()
        if vtype == 17:  # VT_UI1
            return self.read_uchar()
        if vtype == 9:  # VT_DATAOBJECT -- a nested object
            return self.read_object()
        raise ValueError(f"unsupported PropertySet value type {vtype}")

    def read_object(self):
        clsid = self.read_clsid()
        if clsid == "00000000-0000-0000-0000-000000000000":
            return None
        entry = _ARC_OBJECT_READERS.get(clsid)
        if entry is None:
            raise ValueError(f"unrecognized .lyr object class {clsid}")
        needs_ref, needs_version, reader = entry
        if not needs_ref:
            # A handful of classes (workspace factories) carry no
            # reference id or version at all -- just the CLSID, then
            # straight into their own (often empty) body.
            return reader(self, None)
        ref_id = self.read_uint()
        if ref_id in self.ref_objects:
            return self.ref_objects[ref_id]
        version = self.read_ushort() if needs_version else None
        obj = reader(self, version)
        self.ref_objects[ref_id] = obj
        return obj


# --- Per-class field readers -------------------------------------------------
#
# Each function reads exactly one class's own fields off the stream, in the
# order ArcObjects serializes them, and returns whatever this script
# actually needs from that class -- often None, for classes only read
# through to reach a real ecoregion's fill color further down the object
# graph (FeatureClassName, WorkspaceName, PropertySet, the various outline
# line-symbol types...). Consuming their bytes correctly still matters even
# when the value is discarded, since the stream has no per-object length
# prefix to skip over blindly -- getting a field wrong desyncs everything
# that follows.


def _read_feature_layer(s: _ArcObjectStream, version: int):
    s.read_string()  # name
    s.read_string()  # datasource type
    s.read_ushort()  # visible
    s.read_ushort()  # show map tips
    s.read_ushort()  # cached
    s.read_object()  # dataset name (FeatureClassName)
    return s.read_object()  # renderer -- everything this script wants


def _read_feature_class_name(s: _ArcObjectStream, version: int):
    s.read_string()  # layer name
    s.read_string()  # unknown
    s.read_string()  # datasource type
    s.read_string()  # shape field name
    s.read_uint()  # shape type
    s.read_uint()  # feature type
    s.read_ushort()  # unknown
    s.read_object()  # dataset name (WorkspaceName)
    if version == 2:
        for _ in range(s.read_ushort()):
            s.read_object()  # topology (not used for EPA's own data)
    return None


def _read_workspace_name(s: _ArcObjectStream, version: int):
    s.read_string()  # path name
    s.read_string()  # name string
    s.read_string()  # browse name
    s.read_object()  # connection properties (PropertySet)
    if s.read_uchar():  # has factory
        s.read_object()  # workspace factory
    s.read_uint()  # workspace type
    return None


def _read_property_set(s: _ArcObjectStream, version: int):
    for _ in range(s.read_uint()):
        s.read_string()  # key
        s.read_variant()  # value
    return None


def _read_unique_value_renderer(s: _ArcObjectStream, version: int):
    """Stops reading as soon as it has every legend group's classes --
    everything the real UniqueValueRenderer.read() does afterward (a raw
    values array, rotation/transparency attributes, a color ramp...) is
    map-display bookkeeping this script has no use for, and since this is
    always the last thing read from the "Layer" stream, under-reading its
    tail is harmless."""
    for _ in range(s.read_uint()):  # field count
        s.read_string()  # field name
        s.read(3)  # unexplained -- consumed verbatim regardless
    s.read_string()  # concatenator
    s.read_object()  # "all other values" symbol -- not a real ecoregion code
    groups = [s.read_object() for _ in range(s.read_uint())]
    return [c for group in groups if group for c in group]


def _read_legend_group(s: _ArcObjectStream, version: int):
    s.read_ushort()  # visible
    s.read_ushort()  # editable or expanded
    s.read_string()  # heading
    classes = [s.read_object() for _ in range(s.read_uint())]
    if version > 2:
        s.read_ushort()  # unknown
    return classes  # list of (label, fill color or None)


def _read_legend_class(s: _ArcObjectStream, version: int):
    color = s.read_object()  # symbol -- already reduced to just its fill color
    label = s.read_string()
    s.read_string()  # description
    s.read_object()  # format (usually null)
    if version == 2:
        s.read_uint()  # feature count
    return (label, color)


def _read_simple_fill_symbol(s: _ArcObjectStream, version: int):
    s.read_object()  # outline (SimpleLineSymbol or similar)
    color = s.read_object()  # the actual fill color
    s.read_uint()  # raster op
    s.read_uint()  # symbol level
    s.read_uint()  # fill style
    return color


def _read_multi_layer_fill_symbol(s: _ArcObjectStream, version: int):
    s.read_uint()  # raster op
    s.read_uint()  # symbol level
    s.read_object()  # unused color
    layers = [s.read_object() for _ in range(s.read_uint())]
    for _ in layers:
        s.read_uint()  # enabled
    for _ in layers:
        s.read_uint()  # locked
    if version >= 2:
        for _ in layers:
            s.read_string()  # tags
    # The first layer's own fill color is the representative one (matches
    # how EPA's data was cross-checked against this script's earlier
    # PDF-based colors while writing this).
    return layers[0] if layers else None


def _read_color_symbol(s: _ArcObjectStream, version: int):
    color = s.read_object()
    s.read_uint()  # raster op
    s.read_uint()  # symbol level
    s.read_uint()  # unknown
    return color


def _read_simple_line_symbol(s: _ArcObjectStream, version: int):
    s.read_object()  # color
    s.read_double()  # width
    s.read_uint()  # line type
    s.read_uint()  # raster op
    s.read_uint()  # symbol level
    return None


def _read_cartographic_line_symbol(s: _ArcObjectStream, version: int):
    s.read_uint()  # cap
    s.read_uint()  # join
    s.read_double()  # width
    s.read_uchar()  # flip
    s.read_double()  # offset
    s.read_object()  # color
    s.read_object()  # template
    s.read_object()  # decoration
    s.read_uint()  # raster op
    s.read_uint()  # symbol level
    s.read_uchar()  # decoration on top
    s.read_double()  # line start offset
    s.read_double()  # miter limit
    return None


def _read_marker_line_symbol(s: _ArcObjectStream, version: int):
    s.read_uchar()  # flip
    s.read_double()  # offset
    s.read_object()  # pattern marker
    s.read_object()  # template
    s.read_object()  # decoration
    s.read_uint()  # raster op
    s.read_uint()  # symbol level
    s.read_uchar()  # decoration on top
    s.read_double()  # line start offset
    s.read_uint()  # cap
    s.read_uint()  # join
    s.read_double()  # miter limit
    return None


def _read_hash_line_symbol(s: _ArcObjectStream, version: int):
    s.read_double()  # angle
    s.read_uint()  # cap
    s.read_uint()  # join
    s.read_double()  # width
    s.read_uchar()  # flip
    s.read_double()  # offset
    s.read_object()  # line
    s.read_object()  # color
    s.read_object()  # template
    s.read_object()  # decoration
    s.read_uint()  # raster op
    s.read_uint()  # symbol level
    s.read_uchar()  # decoration on top
    s.read_double()  # line start offset
    s.read_double()  # miter limit
    return None


def _read_noop(s: _ArcObjectStream, version):
    return None


def _cielab_to_srgb(l_value: float, a: float, b: float) -> tuple[int, int, int]:
    """ESRI's own CIELab -> RGB conversion for RgbColor/HsvColor/HlsColor/
    GrayColor objects (all four share this exact byte layout and math,
    differing only in their CLSID): standard Lab->XYZ (Bruce Lindbloom's
    public formulas, see brucelindbloom.com) against a Rec709-scaled D65
    white point, then ESRI's own "AppleRGB" working-space matrix, then a
    1/1.8 gamma. Not exercised against any real EPA legend code while
    writing this (every real ecoregion class checked used CmykColor
    instead -- this only ever showed up for the renderer's own
    "<all other values>" catch-all, which isn't a real code and is
    discarded regardless), but kept in case some state's own .lyr uses it
    for a real class."""
    fy = (l_value + 16) / 116.0
    fz = fy - b / 200.0
    fx = a / 500.0 + fy
    e, k = 0.008856, 903.3
    xr = fx**3 if fx**3 > e else (116 * fx - 16) / k
    yr = ((l_value + 16) / 116.0) ** 3 if l_value > k * e else l_value / k
    zr = fz**3 if fz**3 > e else (116 * fz - 16) / k
    xr_ref, yr_ref, zr_ref = 0.9504559270516716, 1.0, 1.0888461217873364
    x, y, z = xr * xr_ref, yr * yr_ref, zr * zr_ref
    r = 2.9515373 * x - 1.2894116 * y - 0.4738445 * z
    g = -1.0851093 * x + 1.9908566 * y + 0.0372026 * z
    bb = 0.0854934 * x - 0.2694964 * y + 1.0912975 * z
    out = []
    for c in (r, g, bb):
        c = max(c, 0.0) ** (1 / 1.8)
        v = round(c * 255)
        out.append(0 if v < 5 else min(v, 255))
    return tuple(out)


def _read_rgb_color(s: _ArcObjectStream, version: int):
    s.read(3)  # unexplained
    l_value, a, b = s.read_double(), s.read_double(), s.read_double()
    s.read_uchar()  # dither
    if s.read_uchar():  # is_null
        return None
    return _cielab_to_srgb(l_value, a, b)


def _read_cmyk_color(s: _ArcObjectStream, version: int):
    s.read(2)  # unexplained
    c, m, y, k = s.read_uchar(), s.read_uchar(), s.read_uchar(), s.read_uchar()
    s.read_uchar()  # dither
    if s.read_uchar():  # is_null
        return None
    c, m, y, k = c / 100.0, m / 100.0, y / 100.0, k / 100.0
    return (
        round(255 * (1 - c) * (1 - k)),
        round(255 * (1 - m) * (1 - k)),
        round(255 * (1 - y) * (1 - k)),
    )


# (needs_ref, needs_version, reader) per class -- see _ArcObjectStream.read_object.
_ARC_OBJECT_READERS: dict[str, tuple[bool, bool, Callable]] = {
    "e663a651-8aad-11d0-bec7-00805f7c4268": (True, True, _read_feature_layer),
    "198846d0-ca42-11d1-aa7c-00c04fa33a15": (True, True, _read_feature_class_name),
    "5a350011-e371-11d1-aa82-00c04fa33a15": (True, True, _read_workspace_name),
    "588e5a11-d09b-11d1-aa7c-00c04fa33a15": (True, True, _read_property_set),
    "c3346d29-b2bc-11d1-8817-080009ec732a": (True, True, _read_unique_value_renderer),
    "167c5ea2-af20-11d1-8817-080009ec732a": (True, True, _read_legend_group),
    "167c5ea3-af20-11d1-8817-080009ec732a": (True, True, _read_legend_class),
    "7914e603-c892-11d0-8bb6-080009ee4e41": (True, True, _read_simple_fill_symbol),
    "7914e604-c892-11d0-8bb6-080009ee4e41": (True, True, _read_multi_layer_fill_symbol),
    "b81f9ae0-026e-11d3-9c1f-00c04f5aa6ed": (True, True, _read_color_symbol),
    "7914e5f9-c892-11d0-8bb6-080009ee4e41": (True, True, _read_simple_line_symbol),
    "7914e5fb-c892-11d0-8bb6-080009ee4e41": (True, True, _read_cartographic_line_symbol),
    "7914e5fd-c892-11d0-8bb6-080009ee4e41": (True, True, _read_marker_line_symbol),
    "7914e5fc-c892-11d0-8bb6-080009ee4e41": (True, True, _read_hash_line_symbol),
    "7ee9c496-d123-11d0-8383-080009b996cc": (True, True, _read_rgb_color),  # Rgb
    "7ee9c497-d123-11d0-8383-080009b996cc": (True, True, _read_cmyk_color),  # Cmyk
    "7ee9c492-d123-11d0-8383-080009b996cc": (True, True, _read_rgb_color),  # Hsv
    "7ee9c493-d123-11d0-8383-080009b996cc": (True, True, _read_rgb_color),  # Hls
    "7ee9c495-d123-11d0-8383-080009b996cc": (True, True, _read_rgb_color),  # Gray
    # Workspace factories -- no reference id, no version, no body at all.
    # Only Shapefile matters for EPA data; the rest are listed defensively.
    "a06adb96-d95c-11d1-aa81-00c04fa33a15": (False, False, _read_noop),  # Shapefile
    "d9b4fa40-d6d9-11d1-aa81-00c04fa33a15": (False, False, _read_noop),  # Sde
    "dd48c96a-d92a-11d1-aa81-00c04fa33a15": (False, False, _read_noop),  # Access
    "71fe75f0-ea0c-4406-873e-b7d53748ae7e": (False, False, _read_noop),  # FileGDB
}


# `[a-z]*` (zero or more), not `[a-z]?` (zero or one): some states' Level
# IV codes carry a two-letter suffix once a broader class gets subdivided
# further (confirmed: Montana's own "17aa" through "17am", a finer split of
# what was originally just "17a" -- a single-letter regex here silently
# dropped exactly these 13 real, present .lyr entries, sending them to the
# generated palette instead for no real reason).
_LYR_LABEL_CODE_RE = re.compile(r"^(\d+[a-z]*)\s")


def fetch_lyr_colors(lyr_bytes: bytes) -> dict[str, str]:
    """Parses a .lyr file's "Layer" stream and returns its real,
    ArcGIS-authored per-code colors as {code: "#rrggbb"}. Raises on any
    structural failure (not the format expected, an object class this
    script doesn't recognize, ...) -- the caller decides how to fall back;
    see fetch_lyr_colors_for_state below."""
    layer_bytes = _read_cfb_stream(lyr_bytes, "Layer")
    classes = _ArcObjectStream(layer_bytes).read_object() or []
    result: dict[str, str] = {}
    for label, color in classes:
        match = _LYR_LABEL_CODE_RE.match(label or "")
        if not match or color is None:
            continue
        r, g, b = color
        result[match.group(1)] = "#{:02x}{:02x}{:02x}".format(r, g, b)
    return result


def _lyr_url_candidates(shapefile_url: str, level: int) -> list[str]:
    """Guesses the .lyr symbology file's URL from the shapefile's own .zip
    URL, using EPA's own consistent per-state file layout
    (.../<prefix>/<prefix>_eco[_l<level>].{zip,lyr,htm}) -- confirmed
    against every state checked while writing this, including several
    whose own EPA download page doesn't link a .lyr file at all (Region
    3's combined Delaware/Maryland/Pennsylvania/Virginia/West Virginia page
    only lists a plain "<state>_eco.zip" bundle with no Symbology link,
    yet "<state>_eco_l4.lyr" exists on the server regardless -- found by
    trying the predictable filename directly rather than trusting only
    what's actually linked)."""
    base = shapefile_url.rsplit(".zip", 1)[0]
    candidates = [base + ".lyr"]
    if not base.endswith(f"_l{level}"):
        candidates.append(f"{base}_l{level}.lyr")
    return candidates


def fetch_lyr_colors_for_state(shapefile_url: str, level: int) -> dict[str, str] | None:
    """Best-effort: finds and downloads the state's own .lyr symbology
    file (from its already-known shapefile URL -- see
    _lyr_url_candidates) and extracts its real EPA colors. Returns None on
    any failure (no .lyr found, unrecognized/unsupported object structure,
    ...) -- style_features() falls back to the generated palette in that
    case, so this can never turn into a hard failure of the whole script."""
    for lyr_url in _lyr_url_candidates(shapefile_url, level):
        try:
            lyr_bytes = fetch(lyr_url)
        except Exception:  # noqa: BLE001 -- just try the next candidate URL
            continue
        try:
            colors = fetch_lyr_colors(lyr_bytes)
        except Exception as error:  # noqa: BLE001 -- this is a best-effort enhancement
            print(
                f"  (couldn't read real colors from {lyr_url}: {error} -- "
                "using generated colors instead)"
            )
            return None
        if not colors:
            continue
        print(f"Found real EPA colors: {lyr_url}")
        print(f"  Matched {len(colors)} real EPA legend colors.")
        return colors
    print("  (no .lyr symbology file found -- using generated colors instead)")
    return None


def fetch_all_lyr_colors(level: int) -> dict[str, str]:
    """The --country counterpart of fetch_lyr_colors_for_state(): there's
    no single .lyr covering the whole merged national file, so this finds
    and reads every state's own and merges their {code: color} results.
    Safe to run over every entry in STATE_NAMES unconditionally -- Hawaii
    and DC (neither in the EPA ecoregion system at all) and any state
    fetch_lyr_colors_for_state() can't read simply contribute nothing, the
    same per-state best-effort fallback the single-state path already
    relies on. A dict update (not a merge that would notice conflicts) is
    correct here specifically because the whole premise this relies on is
    that a given code's color doesn't vary by state -- confirmed for every
    code checked while writing the single-state version of this feature."""
    print(
        f"Fetching real EPA colors from all {len(STATE_NAMES)} states' own "
        ".lyr symbology files..."
    )
    colors: dict[str, str] = {}
    for i, state_name in enumerate(STATE_NAMES, start=1):
        print(f"  [{i}/{len(STATE_NAMES)}] {state_name}")
        try:
            shapefile_url = find_shapefile_url(state_name, level)
        except SystemExit:
            continue
        state_colors = fetch_lyr_colors_for_state(shapefile_url, level)
        if state_colors:
            colors.update(state_colors)
    print(f"Collected {len(colors)} real EPA legend colors across all states.")
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

    poster_colors: dict[str, str] | None = None
    state_name: str | None = None
    if args.country:
        sources = fetch_country_sources(args.level)
        default_output = Path(f"united_states_ecoregions_l{args.level}.geojson")
        # Best-effort: real EPA colors merged from every state's own .lyr
        # symbology file -- see fetch_all_lyr_colors()'s doc comment for why
        # this (unlike the single-state path) has to fetch every state's own
        # rather than just one.
        poster_colors = fetch_all_lyr_colors(args.level)
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
        # Best-effort: real EPA colors from the state's own .lyr symbology
        # file (see the ".lyr symbology reading" section above).
        poster_colors = fetch_lyr_colors_for_state(shapefile_url, args.level)

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
    colors = style_features(
        features,
        name_field,
        parent_field,
        code_field,
        poster_colors,
        display_name=display_name_for(args.level, state_name),
    )

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
