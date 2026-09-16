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

WHY NO THIRD-PARTY DEPENDENCIES
    Standard library only (urllib, zipfile, struct, re, colorsys, ...) -- no
    `pip install` needed. Geometry (.shp/.shx) is never parsed at all, only
    copied through byte-for-byte, since styling never changes it; the only
    binary format this script actually reads and writes is the .dbf
    (dBase III, no memo file), which is simple enough to handle directly.

USAGE
    python3 fetch_state_ecoregions.py "Montana"
    python3 fetch_state_ecoregions.py "New York" --level 4 --output ./layers
"""

from __future__ import annotations

import argparse
import colorsys
import io
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

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("state", help='US state name, e.g. "Montana" or "New York"')
    parser.add_argument(
        "--level",
        type=int,
        choices=(3, 4),
        default=3,
        help="EPA ecoregion level of detail (default: 3, coarser/smaller)",
    )
    parser.add_argument(
        "--field",
        help="Attribute field to color by (default: auto-detected, e.g. US_L3NAME)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Output folder (default: ./<state>_ecoregions_l<level>/)",
    )
    args = parser.parse_args()

    state_name = resolve_state_name(args.state)
    print(
        f"Looking for {state_name}'s Level {args.level} ecoregions across "
        f"EPA regions 1-{NUM_EPA_REGIONS}..."
    )
    shapefile_url = find_shapefile_url(state_name, args.level)
    print(f"Found: {shapefile_url}")

    print("Downloading...")
    zip_bytes = fetch(shapefile_url)

    output_dir = args.output or Path(
        f"{state_name.lower().replace(' ', '_')}_ecoregions_l{args.level}"
    )
    output_dir.mkdir(parents=True, exist_ok=True)
    base_name = f"{state_name.lower().replace(' ', '_')}_l{args.level}"

    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as archive:
        members = {Path(name).suffix.lower(): name for name in archive.namelist()}
        if ".shp" not in members or ".dbf" not in members:
            raise SystemExit(
                f"The downloaded zip doesn't look like a shapefile "
                f"(contents: {archive.namelist()})."
            )
        for suffix in (".shp", ".shx", ".dbf", ".prj", ".cpg"):
            if suffix not in members:
                continue
            (output_dir / f"{base_name}{suffix}").write_bytes(
                archive.read(members[suffix])
            )

    print("Reading attribute table...")
    dbf_bytes = (output_dir / f"{base_name}.dbf").read_bytes()
    fields, records = read_dbf(dbf_bytes)

    field_name = args.field or find_name_field(fields, args.level)
    print(f"Coloring by: {field_name}")
    styled_records, colors = style_records(records, field_name)

    output_fields = fields + [
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
