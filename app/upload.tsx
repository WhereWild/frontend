import Head from 'expo-router/head';
import React from 'react';
import { Platform } from 'react-native';
import { UploadScreen } from '@/components/upload/UploadScreen';

export default function Upload() {
  return (
    <>
      {Platform.OS === 'web' ? (
        <Head>
          <title>WhereWild | Upload</title>
        </Head>
      ) : null}
      <UploadScreen />
    </>
  );
}
