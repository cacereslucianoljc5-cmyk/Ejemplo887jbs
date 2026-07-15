'use client';
import { cn } from '../lib/utils';
import createGlobe from 'cobe';
import { useEffect, useRef } from 'react';

/**
 * Earth / Globe — based on the ui-layouts "globe" component (cobe).
 * Recolored to the Ascend green palette and seeded with a few
 * financial-hub markers to read as a global liquidity layer.
 */
const Globe = ({
  className,
  theta = 0.25,
  dark = 1,
  scale = 1.05,
  diffuse = 1.2,
  mapSamples = 42000,
  mapBrightness = 7,
  baseColor = [0.05, 0.62, 0.12],
  markerColor = [0.02, 0.5, 0.06],
  glowColor = [0.16, 0.78, 0.22],
}) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    let width = 0;
    const onResize = () =>
      canvasRef.current && (width = canvasRef.current.offsetWidth);
    window.addEventListener('resize', onResize);
    onResize();
    let phi = 0;

    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: width * 2,
      height: width * 2,
      phi: 0,
      theta,
      dark,
      scale,
      diffuse,
      mapSamples,
      mapBrightness,
      baseColor,
      markerColor,
      glowColor,
      opacity: 1,
      offset: [0, 0],
      markers: [
        { location: [40.7128, -74.006], size: 0.06 }, // New York
        { location: [51.5074, -0.1278], size: 0.05 }, // London
        { location: [1.3521, 103.8198], size: 0.05 }, // Singapore
        { location: [35.6762, 139.6503], size: 0.05 }, // Tokyo
        { location: [-23.5505, -46.6333], size: 0.04 }, // São Paulo
        { location: [25.2048, 55.2708], size: 0.04 }, // Dubai
      ],
      onRender: (state) => {
        state.phi = phi;
        phi += 0.003;
      },
    });

    return () => {
      globe.destroy();
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <div
      className={cn(
        'globe-wrap flex items-center justify-center z-10 w-full',
        className
      )}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          maxWidth: '100%',
          aspectRatio: '1',
        }}
      />
    </div>
  );
};

export default Globe;
