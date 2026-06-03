// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

type BlobWithNativeHelpers = Blob & {
  arrayBuffer?: () => Promise<ArrayBuffer>;
  bytes?: () => Promise<Uint8Array>;
};

type BlobReadMessages = {
  unavailableMessage: string;
  readErrorMessage: string;
  invalidResultMessage: string;
};

const readBlobWithFileReader = async (
  blob: Blob,
  messages: BlobReadMessages,
): Promise<ArrayBuffer> => {
  const FileReaderCtor = globalThis.FileReader;
  if (typeof FileReaderCtor !== 'function') {
    throw new Error(messages.unavailableMessage);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReaderCtor();
    reader.onerror = () => {
      reject(new Error(messages.readErrorMessage));
    };
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
        return;
      }
      reject(new Error(messages.invalidResultMessage));
    };
    reader.readAsArrayBuffer(blob);
  });
};

export const readBlobAsArrayBuffer = async (
  blob: Blob,
  messages: BlobReadMessages,
): Promise<ArrayBuffer> => {
  const blobWithNativeHelpers = blob as BlobWithNativeHelpers;

  if (typeof blobWithNativeHelpers.arrayBuffer === 'function') {
    return blobWithNativeHelpers.arrayBuffer();
  }

  if (typeof blobWithNativeHelpers.bytes === 'function') {
    const bytes = await blobWithNativeHelpers.bytes();
    return bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    );
  }

  return readBlobWithFileReader(blob, messages);
};

export const readBlobAsUint8Array = async (
  blob: Blob,
  messages: BlobReadMessages,
): Promise<Uint8Array> => {
  const blobWithNativeHelpers = blob as BlobWithNativeHelpers;

  if (typeof blobWithNativeHelpers.bytes === 'function') {
    return blobWithNativeHelpers.bytes();
  }

  return new Uint8Array(await readBlobAsArrayBuffer(blob, messages));
};
