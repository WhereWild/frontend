import Head from 'expo-router/head';
import React from 'react';
import { UploadScreen } from '@/components/upload/UploadScreen';

export default function Upload() {
  return (
    <>
      <Head>
        <title>WhereWild | Upload</title>
      </Head>
      <UploadScreen />
    </>
  );
}
