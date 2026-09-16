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
    2. Downloads and unzips it.
    3. Picks an ecoregion-name column from its attribute table (the actual
       column name varies -- Level III shapefiles typically use US_L3NAME,
       Level IV use US_L4NAME -- so this looks for it rather than assuming)
       and assigns each distinct ecoregion a color.
    4. Rewrites the .dbf (only the .dbf -- geometry is never touched) with
       three extra columns: WW_MODE, WW_FIELD, WW_COLOR. This is exactly the
       convention /gis-editor's own "Save" writes and reads back (see
       components/gisEditor/shapefileWriter.ts / shapefileMetadata.ts in
       this repo) -- it's a real, documented format, not internal-only, so
       ANY script that writes these same three .dbf columns produces a file
       /gis-editor opens pre-styled. This script is one example of that;
       it isn't a special/blessed path.
    5. Writes the result -- the original .shp/.shx/.prj/.cpg untouched, plus
       the rewritten .dbf -- as loose files in an output folder. Drag all of
       them into /gis-editor together (it doesn't accept zipped shapefiles
       yet -- see shapefileMetadata.ts's doc comment for why) and it opens
       already colored by ecoregion, with names already filled in.

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
    different classification without the US_L3 refinement at all) -- so the
    two are reprojected into one shared plain-geographic coordinate space
    and merged here. Hawaii isn't part of the EPA's ecoregion system at all
    (checked all 10 region pages) and can't be included from this data
    source.

    Alaska has no Level IV data at all -- since --level defaults to 4,
    `--country` on its own covers the lower 48 only; pass `--level 3` to
    also fetch and merge in Alaska.

    The reprojection is real ellipsoidal Albers Equal-Area Conic math
    (Snyder 1987), not an approximation -- its parameters are read straight
    out of each file's own .prj (so this isn't special-cased to only these
    two specific files' projections), and its output was cross-checked
    against `pyproj` on both this file's actual EPSG:5070 (CONUS) and
    EPSG:3338 (Alaska) parameters to 8 decimal places while writing this,
    without adding pyproj as a runtime dependency of the shipped script.

WHY NO THIRD-PARTY DEPENDENCIES
    Standard library only (urllib, zipfile, struct, re, colorsys, math,
    ...) -- no `pip install` needed. For a single state, geometry (.shp/
    .shx) is never even parsed, only copied through byte-for-byte, since
    styling never changes it. --country is the exception: merging requires
    actually reading and reprojecting every polygon vertex, which is why
    that path is real coordinate-geometry code rather than a byte copy.

USAGE
    python3 fetch_state_ecoregions.py "Montana"
    python3 fetch_state_ecoregions.py "New York" --level 3 --output ./layers
    python3 fetch_state_ecoregions.py --country
    python3 fetch_state_ecoregions.py --country --level 3   # also include Alaska
"""

from __future__ import annotations

import argparse
import colorsys
import io
import math
import re
import struct
import sys
import zipfile
from dataclasses import dataclass
from datetime import date
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


# --- Minimal DBF (dBase III, no memo) reader/writer -------------------------
#
# Same byte layout as components/gisEditor/shapefileWriter.ts's buildDbf()
# in this repo, in the other direction (that one only writes; this one also
# reads, since we're starting from an existing .dbf rather than parsed
# GeoJSON properties). Deliberately not using a library here -- the format
# is small and stable enough that hand-rolling it keeps this script
# dependency-free, and it doubles as a from-scratch reference for the exact
# same convention the TypeScript writer uses.


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


def build_dbf(fields: list[DbfField], records: list[dict[str, object]]) -> bytes:
    header_length = 32 + 32 * len(fields) + 1
    record_length = 1 + sum(f.length for f in fields)
    out = bytearray(header_length + record_length * len(records))

    today = date.today()
    out[0] = 0x03
    out[1] = max(0, today.year - 1900)
    out[2] = today.month
    out[3] = today.day
    struct.pack_into("<I", out, 4, len(records))
    struct.pack_into("<H", out, 8, header_length)
    struct.pack_into("<H", out, 10, record_length)

    offset = 32
    for field in fields:
        name_bytes = field.name.encode("ascii")[:10]
        out[offset : offset + len(name_bytes)] = name_bytes
        out[offset + 11] = ord(field.type)
        out[offset + 16] = field.length
        out[offset + 17] = field.decimals
        offset += 32
    out[offset] = 0x0D

    pos = header_length
    for record in records:
        out[pos] = 0x20  # not deleted
        o = pos + 1
        for field in fields:
            value = record.get(field.name)
            if field.type == "L":
                text = "?" if value is None else ("T" if value else "F")
                text = text.ljust(field.length)
            elif field.type == "N":
                text = "" if value is None else f"{value:.{field.decimals}f}"
                text = text.rjust(field.length)
            else:
                text = "" if value is None else str(value)
                text = text.ljust(field.length)
            value_bytes = text.encode("ascii", errors="replace")[: field.length]
            value_bytes = value_bytes.ljust(field.length, b" ")
            out[o : o + field.length] = value_bytes
            o += field.length
        pos += record_length

    return bytes(out)


# --- .shp geometry reader/writer, and --country's reprojection/merge -------
#
# The single-state path above never touches .shp/.shx at all -- geometry is
# always copied through byte-for-byte, since styling never changes it. But
# --country genuinely has to merge geometry from two files that are each in
# their own different projected coordinate system (verified against their
# real .prj files: the national CONUS file is EPSG:5070, Alaska's own file
# is EPSG:3338 -- meters in two incompatible Albers Conic projections
# centered on different meridians), so their coordinates have to be
# reprojected into one shared space before they can live in the same file
# at all. This only supports Polygon (shape type 5) -- the shape type every
# EPA ecoregion shapefile actually uses -- and only Albers-projected or
# already-geographic sources, which is everything this script ever
# downloads; anything else raises a clear error rather than silently
# producing corrupt geometry.

NAD83_GEOGRAPHIC_WKT = (
    'GEOGCS["GCS_North_American_1983",DATUM["D_North_American_1983",'
    'SPHEROID["GRS_1980",6378137.0,298.257222101]],PRIMEM["Greenwich",0.0],'
    'UNIT["Degree",0.0174532925199433]]'
)


def parse_prj(wkt: str) -> dict:
    """Reads the ellipsoid and (if present) Albers projection parameters
    straight out of a .prj's WKT, rather than assuming/hardcoding a
    specific EPSG code -- this is what makes reproject_point() below work
    for whatever the actual source file turns out to be, not just the two
    specific files --country currently fetches.
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
            "--country's reprojection only supports ellipsoidal sources."
        )
    e2 = 2 / inv_f - 1 / inv_f**2
    e = math.sqrt(e2)

    if "PROJCS" not in wkt:
        return {"kind": "geographic", "a": a, "e": e}

    projection = re.search(r'PROJECTION\["([^"]+)"\]', wkt)
    if not projection or projection.group(1) != "Albers":
        name = projection.group(1) if projection else "unknown"
        raise SystemExit(
            f"--country's reprojection only supports Albers-projected or "
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
    independent implementation of EPSG:5070 and EPSG:3338 (this projection's
    two real-world uses in this script) to 8 decimal places on multiple
    test points while writing this -- not just derived from the formula and
    trusted blind.
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


def reproject_polygon_record(
    content: bytes, info: dict
) -> tuple[bytes, tuple[float, float, float, float]]:
    shape_type = struct.unpack_from("<i", content, 0)[0]
    if shape_type != 5:
        raise SystemExit(
            f"--country merging only supports Polygon shapefiles "
            f"(got shape type {shape_type})."
        )
    num_parts = struct.unpack_from("<i", content, 36)[0]
    num_points = struct.unpack_from("<i", content, 40)[0]
    points_offset = 44 + 4 * num_parts

    out = bytearray(content)  # parts array + everything but box/points is unchanged
    min_x = min_y = float("inf")
    max_x = max_y = float("-inf")
    for i in range(num_points):
        x, y = struct.unpack_from("<2d", content, points_offset + i * 16)
        lon, lat = reproject_point(x, y, info)
        struct.pack_into("<2d", out, points_offset + i * 16, lon, lat)
        min_x, max_x = min(min_x, lon), max(max_x, lon)
        min_y, max_y = min(min_y, lat), max(max_y, lat)
    struct.pack_into("<4d", out, 4, min_x, min_y, max_x, max_y)
    return bytes(out), (min_x, min_y, max_x, max_y)


def build_shp(records: list[bytes], bbox: tuple[float, float, float, float]) -> bytes:
    total_content = sum(8 + len(r) for r in records)
    out = bytearray(100 + total_content)
    struct.pack_into(">i", out, 0, 9994)
    struct.pack_into(">i", out, 24, (100 + total_content) // 2)
    struct.pack_into("<i", out, 28, 1000)
    struct.pack_into("<i", out, 32, 5)  # Polygon
    struct.pack_into("<4d", out, 36, *bbox)
    pos = 100
    for i, content in enumerate(records, start=1):
        struct.pack_into(">i", out, pos, i)
        struct.pack_into(">i", out, pos + 4, len(content) // 2)
        out[pos + 8 : pos + 8 + len(content)] = content
        pos += 8 + len(content)
    return bytes(out)


def build_shx(records: list[bytes], bbox: tuple[float, float, float, float]) -> bytes:
    out = bytearray(100 + 8 * len(records))
    struct.pack_into(">i", out, 0, 9994)
    struct.pack_into(">i", out, 24, (100 + 8 * len(records)) // 2)
    struct.pack_into("<i", out, 28, 1000)
    struct.pack_into("<i", out, 32, 5)
    struct.pack_into("<4d", out, 36, *bbox)
    pos = 100
    offset_words = 50  # the 100-byte header, in 16-bit words
    for i, content in enumerate(records):
        content_words = len(content) // 2
        struct.pack_into(">i", out, pos, offset_words)
        struct.pack_into(">i", out, pos + 4, content_words)
        offset_words += 4 + content_words  # 8-byte record header = 4 words
        pos += 8
    return bytes(out)


def merge_shapefile_sources(
    sources: list[dict[str, bytes]],
) -> tuple[bytes, bytes, bytes]:
    """Each source is {'shp':..., 'dbf':..., 'prj':...} raw bytes. Reprojects
    every source's geometry into plain NAD83 geographic degrees and
    concatenates -- attribute fields are unioned by name (a field only one
    source has is just blank on the other source's rows), same idea as
    read_dbf/build_dbf's existing "missing field -> None" handling.
    """
    all_records: list[bytes] = []
    overall_bbox = [float("inf"), float("inf"), float("-inf"), float("-inf")]
    field_specs: dict[str, DbfField] = {}
    all_dbf_records: list[dict[str, object]] = []

    for source in sources:
        info = parse_prj(source[".prj"].decode("ascii", errors="replace"))
        shape_type, raw_records = read_shp_records(source[".shp"])
        if shape_type != 5:
            raise SystemExit(
                f"--country merging only supports Polygon shapefiles "
                f"(got shape type {shape_type})."
            )
        for raw in raw_records:
            reprojected, bbox = reproject_polygon_record(raw, info)
            all_records.append(reprojected)
            overall_bbox[0] = min(overall_bbox[0], bbox[0])
            overall_bbox[1] = min(overall_bbox[1], bbox[1])
            overall_bbox[2] = max(overall_bbox[2], bbox[2])
            overall_bbox[3] = max(overall_bbox[3], bbox[3])

        fields, dbf_records = read_dbf(source[".dbf"])
        if len(dbf_records) != len(raw_records):
            raise SystemExit(
                "A source's geometry count didn't match its attribute "
                "record count -- refusing to merge misaligned data."
            )
        for field in fields:
            existing = field_specs.get(field.name)
            if existing is None or existing.length < field.length:
                field_specs[field.name] = field
        all_dbf_records.extend(dbf_records)

    shp_bytes = build_shp(all_records, tuple(overall_bbox))
    shx_bytes = build_shx(all_records, tuple(overall_bbox))
    dbf_bytes = build_dbf(list(field_specs.values()), all_dbf_records)
    return shp_bytes, shx_bytes, dbf_bytes


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


def find_code_field(fields: list[DbfField], name_field: str) -> str | None:
    """EPA's Level IV (and III) ecoregion names aren't unique on their own
    -- the same name can recur under different parent regions (e.g. two
    different "Salt Deserts" nested in different Level III ecoregions,
    confirmed against real downloaded data) -- the real disambiguator is
    the paired *_CODE column (e.g. US_L4NAME's own US_L4CODE: '13a', '13b',
    ... -- these letter-suffixed subclass codes are exactly what EPA's own
    published tables prefix the name with). This looks for that
    counterpart generically (swap NAME for CODE in whatever field name is
    actually being colored by, not hardcoded to US_L3/US_L4 specifically),
    returning None if there isn't one -- coloring still works fine without
    a prefix, just with less disambiguation between same-named regions.
    """
    candidate = name_field.upper().replace("NAME", "CODE")
    if candidate == name_field.upper():
        return None  # name_field didn't contain "NAME" at all
    by_upper = {f.name.upper(): f.name for f in fields}
    return by_upper.get(candidate)


LABEL_FIELD_NAME = "ECO_LABEL"


def add_disambiguated_labels(
    records: list[dict[str, object]], name_field: str, code_field: str | None
) -> list[dict[str, object]]:
    """Adds a new ECO_LABEL field ("<code> <name>", e.g. "13a Salt
    Deserts") to every record, without touching the original *_NAME/*_CODE
    columns -- this is what gets colored by and saved as WW_FIELD, so the
    class names shown in /gis-editor actually disambiguate same-named
    ecoregions the way EPA's own reference tables do, while the original
    EPA schema stays exactly as downloaded.
    """
    if code_field is None:
        return [
            {**r, LABEL_FIELD_NAME: str(r.get(name_field, ""))} for r in records
        ]
    labeled = []
    for r in records:
        code = str(r.get(code_field, "")).strip()
        name = str(r.get(name_field, "")).strip()
        labeled.append({**r, LABEL_FIELD_NAME: f"{code} {name}".strip()})
    return labeled


def style_records(
    records: list[dict[str, object]], field_name: str
) -> tuple[list[dict[str, object]], dict[str, str]]:
    # dict preserves insertion order (Python 3.7+), so this doubles as an
    # ordered set of distinct values in first-seen order -- same convention
    # as vectorEditableMeta.ts's distinctFieldValues().
    distinct_values = list(
        dict.fromkeys(str(r.get(field_name, "")) for r in records)
    )
    colors = {
        value: default_class_color(i, len(distinct_values))
        for i, value in enumerate(distinct_values)
    }
    styled = [
        {
            **record,
            "WW_MODE": "categorical",
            "WW_FIELD": field_name,
            "WW_COLOR": colors[str(record.get(field_name, ""))],
        }
        for record in records
    ]
    return styled, colors


# --- Main --------------------------------------------------------------------

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
            if suffix in (".shp", ".shx", ".dbf", ".prj", ".cpg")
        }


def fetch_country(level: int) -> dict[str, bytes]:
    """Builds a single lower-48-plus-Alaska shapefile (see the --COUNTRY
    section of this module's docstring for why no existing file already
    does this, and how the merge/reprojection works)."""
    national_url = NATIONAL_SHAPEFILE_URL.format(level=level)
    print(f"Downloading the national (lower 48) shapefile: {national_url}")
    national = fetch_zip_members(national_url)
    sources = [national]

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

    print(f"Reprojecting and merging {len(sources)} source file(s)...")
    shp_bytes, shx_bytes, dbf_bytes = merge_shapefile_sources(sources)
    return {
        ".shp": shp_bytes,
        ".shx": shx_bytes,
        ".dbf": dbf_bytes,
        ".prj": NAD83_GEOGRAPHIC_WKT.encode("ascii"),
    }


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
        help="Build one merged shapefile for the lower 48 + Alaska instead of a single state",
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
        help="Output folder (default: ./<state>_ecoregions_l<level>/)",
    )
    args = parser.parse_args()

    if args.country and args.state:
        raise SystemExit("Pass either a state name or --country, not both.")
    if not args.country and not args.state:
        raise SystemExit("Pass a state name, or --country for the whole country.")

    if args.country:
        base_name = f"united_states_l{args.level}"
        output_dir = args.output or Path(f"united_states_ecoregions_l{args.level}")
        output_dir.mkdir(parents=True, exist_ok=True)
        members = fetch_country(args.level)
    else:
        state_name = resolve_state_name(args.state)
        print(
            f"Looking for {state_name}'s Level {args.level} ecoregions across "
            f"EPA regions 1-{NUM_EPA_REGIONS}..."
        )
        shapefile_url = find_shapefile_url(state_name, args.level)
        print(f"Found: {shapefile_url}")
        print("Downloading...")
        members = fetch_zip_members(shapefile_url)
        base_name = f"{state_name.lower().replace(' ', '_')}_l{args.level}"
        output_dir = args.output or Path(
            f"{state_name.lower().replace(' ', '_')}_ecoregions_l{args.level}"
        )
        output_dir.mkdir(parents=True, exist_ok=True)

    for suffix, data in members.items():
        (output_dir / f"{base_name}{suffix}").write_bytes(data)

    print("Reading attribute table...")
    dbf_bytes = (output_dir / f"{base_name}.dbf").read_bytes()
    fields, records = read_dbf(dbf_bytes)

    name_field = args.field or find_name_field(fields, args.level)
    code_field = find_code_field(fields, name_field)
    if code_field:
        print(f"Coloring by: {code_field} + {name_field} (e.g. \"13a Salt Deserts\")")
    else:
        print(f"Coloring by: {name_field}")
    labeled_records = add_disambiguated_labels(records, name_field, code_field)
    styled_records, colors = style_records(labeled_records, LABEL_FIELD_NAME)

    label_length = min(254, max((len(v) for v in colors), default=1))
    output_fields = fields + [
        DbfField(LABEL_FIELD_NAME, "C", label_length),
        DbfField("WW_MODE", "C", 12),
        DbfField("WW_FIELD", "C", 32),
        DbfField("WW_COLOR", "C", 7),
    ]
    (output_dir / f"{base_name}.dbf").write_bytes(
        build_dbf(output_fields, styled_records)
    )

    print(f"\n{len(colors)} ecoregion(s) found:")
    for value, color in colors.items():
        print(f"  {color}  {value}")
    print(f"\nWrote {output_dir}/ -- drag its files into /gis-editor together.")


if __name__ == "__main__":
    main()
