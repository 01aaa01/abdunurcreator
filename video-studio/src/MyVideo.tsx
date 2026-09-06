// =====================================================
// PASTE THE AI-GENERATED CODE HERE
// Delete everything in this file and paste the new code
// =====================================================

import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';

export const MyVideo: React.FC = () => {
  const frame = useCurrentFrame();
  
  const opacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#1a1a2e',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <h1
        style={{
          color: 'white',
          fontSize: 80,
          fontFamily: 'Arial, sans-serif',
          opacity,
          margin: 0,
        }}
      >
        Your studio is ready!
      </h1>
    </AbsoluteFill>
  );
};
