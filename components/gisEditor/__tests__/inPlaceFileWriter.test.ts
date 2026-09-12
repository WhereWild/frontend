// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: MIT

import {
  canWriteInPlace,
  writeTiffInPlace,
  type WritableFileHandle,
} from '../inPlaceFileWriter';

const LE = true;

// Same minimal classic-TIFF shape as tiffMetadataWriter.test.ts: 8-byte
// header, 4 bytes of pixel data, one IFD with ImageWidth/Length/StripOffsets.
const buildMinimalTiff = (): Uint8Array<ArrayBuffer> => {
  const pixelData = new TextEncoder().encode('PXPX');
  const pixelDataOffset = 8;
  const ifd0Offset = pixelDataOffset + pixelData.length;
  const inlineShort = (v: number) => {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint16(0, v, LE);
    return b;
  };
  const inlineLong = (v: number) => {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, v, LE);
    return b;
  };
  const entries = [
    { tag: 256, type: 3, count: 1, value: inlineShort(100) },
    { tag: 257, type: 3, count: 1, value: inlineShort(50) },
    { tag: 273, type: 4, count: 1, value: inlineLong(pixelDataOffset) },
  ];
  const ifdLen = 2 + entries.length * 12 + 4;
  const ifdBuf = new ArrayBuffer(ifdLen);
  const ifdView = new DataView(ifdBuf);
  ifdView.setUint16(0, entries.length, LE);
  entries.forEach((e, i) => {
    const base = 2 + i * 12;
    ifdView.setUint16(base, e.tag, LE);
    ifdView.setUint16(base + 2, e.type, LE);
    ifdView.setUint32(base + 4, e.count, LE);
    new Uint8Array(ifdBuf, base + 8, 4).set(e.value);
  });
  ifdView.setUint32(2 + entries.length * 12, 0, LE);

  const header = new ArrayBuffer(8);
  const hv = new DataView(header);
  hv.setUint8(0, 0x49);
  hv.setUint8(1, 0x49);
  hv.setUint16(2, 42, LE);
  hv.setUint32(4, ifd0Offset, LE);

  const out = new Uint8Array(
    header.byteLength + pixelData.length + ifdBuf.byteLength,
  );
  out.set(new Uint8Array(header), 0);
  out.set(pixelData, header.byteLength);
  out.set(new Uint8Array(ifdBuf), header.byteLength + pixelData.length);
  return out;
};

describe('canWriteInPlace', () => {
  it('is false for a handle with no permission API (feature-detection)', async () => {
    await expect(canWriteInPlace({ createWritable: jest.fn() })).resolves.toBe(
      false,
    );
  });

  it('is false for a null handle', async () => {
    await expect(canWriteInPlace(null)).resolves.toBe(false);
  });

  it('is true when permission is already granted', async () => {
    const handle: WritableFileHandle = {
      queryPermission: jest.fn().mockResolvedValue('granted'),
      requestPermission: jest.fn(),
      createWritable: jest.fn(),
    };
    await expect(canWriteInPlace(handle)).resolves.toBe(true);
    expect(handle.requestPermission).not.toHaveBeenCalled();
  });

  it('requests permission when not already granted, and reflects the result', async () => {
    const handle: WritableFileHandle = {
      queryPermission: jest.fn().mockResolvedValue('prompt'),
      requestPermission: jest.fn().mockResolvedValue('denied'),
      createWritable: jest.fn(),
    };
    await expect(canWriteInPlace(handle)).resolves.toBe(false);
    expect(handle.requestPermission).toHaveBeenCalledWith({
      mode: 'readwrite',
    });
  });

  it('is false when the permission API throws', async () => {
    const handle: WritableFileHandle = {
      queryPermission: jest.fn().mockRejectedValue(new Error('nope')),
      requestPermission: jest.fn(),
      createWritable: jest.fn(),
    };
    await expect(canWriteInPlace(handle)).resolves.toBe(false);
  });
});

describe('writeTiffInPlace', () => {
  it('writes only the header and the appended tail, never the shared body', async () => {
    const original = buildMinimalTiff();
    const originalBlob = new Blob([original]);

    // Simulate what embedMetadataIntoTiff() produces: same 8-byte header
    // (bytes changed), same body in between, plus an appended tail.
    const newHeader = new Uint8Array(original.slice(0, 8));
    newHeader[4] = 0xaa; // pretend the IFD0 offset field changed
    const tail = new TextEncoder().encode('NEWTAGBYTES');
    const savedBlob = new Blob([newHeader, original.slice(8), tail]);

    const writes: { position: number; length: number }[] = [];
    const writable = {
      write: jest.fn(async (w: { position: number; data: BufferSource }) => {
        const length =
          w.data instanceof ArrayBuffer
            ? w.data.byteLength
            : (w.data as ArrayBufferView).byteLength;
        writes.push({ position: w.position, length });
      }),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const handle: WritableFileHandle = {
      createWritable: jest.fn().mockResolvedValue(writable),
    };

    await writeTiffInPlace(handle, originalBlob, savedBlob);

    expect(handle.createWritable).toHaveBeenCalledWith({
      keepExistingData: true,
    });
    // Two writes: the header at offset 0, and the tail starting exactly at
    // the original file's end — never the multi-byte shared body.
    expect(writes).toEqual([
      { position: 0, length: 8 },
      { position: originalBlob.size, length: tail.length },
    ]);
    expect(writable.close).toHaveBeenCalled();
  });

  it('still closes the stream if a write throws', async () => {
    const originalBlob = new Blob([buildMinimalTiff()]);
    const savedBlob = new Blob([originalBlob, new TextEncoder().encode('X')]);
    const writable = {
      write: jest.fn().mockRejectedValue(new Error('disk full')),
      close: jest.fn().mockResolvedValue(undefined),
    };
    const handle: WritableFileHandle = {
      createWritable: jest.fn().mockResolvedValue(writable),
    };

    await expect(
      writeTiffInPlace(handle, originalBlob, savedBlob),
    ).rejects.toThrow('disk full');
    expect(writable.close).toHaveBeenCalled();
  });
});
