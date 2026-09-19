// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// True in-place "Save" for /gis-editor, via the File System Access API
// (Chromium; drag-and-dropped files only — `DataTransferItem.
// getAsFileSystemHandle()` isn't exposed for files chosen through an
// `<input type="file">`/document-picker dialog).
//
// Without this, "Save" has to hand the browser a full copy of the file —
// tiffMetadataWriter.ts's Blob composition never loads the pixel data into
// JS memory, but the browser still has to read the entire original file
// off disk and write the entire result back out to download it, which for
// a multi-gigabyte raster is exactly the "redownloading the whole file"
// cost this module exists to avoid.
//
// embedMetadataIntoTiff() only actually changes two small ranges: the
// header (patched to point at the new IFD0) and a tail appended after the
// original end of the file (new tag values + the new IFD) — the body in
// between is always byte-identical to the original (see that module's own
// doc comment). So with real write access to the original file, "save" is
// two small writes — a few dozen bytes at offset 0, a few KB at the old
// EOF — never touching the multi-gigabyte body at all.

import { getTiffHeaderSize } from './tiffMetadataWriter';

type PermissionStateLike = 'granted' | 'denied' | 'prompt';

export type WritableFileHandle = {
  queryPermission?: (opts: {
    mode: 'readwrite';
  }) => Promise<PermissionStateLike>;
  requestPermission?: (opts: {
    mode: 'readwrite';
  }) => Promise<PermissionStateLike>;
  createWritable: (opts?: {
    keepExistingData?: boolean;
  }) => Promise<WritableFileStreamLike>;
};

type WritableFileStreamLike = {
  write: (data: {
    type: 'write';
    position: number;
    data: BufferSource;
  }) => Promise<void>;
  close: () => Promise<void>;
};

/** True once real write access to `handle` is confirmed (prompting the
 * user for permission if needed) — false for anything that isn't a real
 * writable file-system handle, so callers can fall back to a download
 * without treating that as an error. */
export const canWriteInPlace = async (
  handle: WritableFileHandle | null | undefined,
): Promise<boolean> => {
  if (!handle?.queryPermission || !handle.requestPermission) return false;
  try {
    const already = await handle.queryPermission({ mode: 'readwrite' });
    if (already === 'granted') return true;
    const requested = await handle.requestPermission({ mode: 'readwrite' });
    return requested === 'granted';
  } catch {
    return false;
  }
};

/**
 * Patches `handle`'s underlying file with the metadata already embedded
 * into `savedBlob` by embedMetadataIntoTiff(), writing only the header and
 * the appended tail — never the untouched body `originalBlob` and
 * `savedBlob` share in between.
 */
export const writeTiffInPlace = async (
  handle: WritableFileHandle,
  originalBlob: Blob,
  savedBlob: Blob,
): Promise<void> => {
  const headerSize = await getTiffHeaderSize(originalBlob);
  const writable = await handle.createWritable({ keepExistingData: true });
  try {
    const header = await savedBlob.slice(0, headerSize).arrayBuffer();
    await writable.write({ type: 'write', position: 0, data: header });

    const tail = savedBlob.slice(originalBlob.size);
    if (tail.size > 0) {
      const tailBytes = await tail.arrayBuffer();
      await writable.write({
        type: 'write',
        position: originalBlob.size,
        data: tailBytes,
      });
    }
  } finally {
    await writable.close();
  }
};
