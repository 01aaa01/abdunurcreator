import React from 'react';
import { Composition } from 'remotion';
import { MyVideo } from './MyVideo';

// =====================================================
// VIDEO SETTINGS - Modify these values as needed
// =====================================================
const DURATION_SECONDS = 5;  // Change this based on your video
const FPS = 30;
const WIDTH = 1920;   // 1920 for landscape, 1080 for portrait
const HEIGHT = 1080;  // 1080 for landscape, 1920 for portrait

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="MyVideo"
      component={MyVideo}
      durationInFrames={DURATION_SECONDS * FPS}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  );
};
