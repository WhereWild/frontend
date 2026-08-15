// SPDX-FileCopyrightText: 2025-2026 The WhereWild Contributors (see CONTRIBUTORS)
//
// SPDX-License-Identifier: AGPL-3.0-or-later

// Wraps Expo's default babel transformer so `.md` files import as raw
// strings (`export default` the file's text) instead of being parsed as JS.
const upstreamTransformer = require('@expo/metro-config/babel-transformer');

module.exports.transform = async (args) => {
  if (!args.filename.endsWith('.md')) {
    return upstreamTransformer.transform(args);
  }

  const jsSource = `module.exports = ${JSON.stringify(args.src)};\n`;
  return upstreamTransformer.transform({ ...args, src: jsSource });
};
