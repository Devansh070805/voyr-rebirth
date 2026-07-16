"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Color, Scene, Fog, PerspectiveCamera, Vector3 } from "three";
import ThreeGlobe from "three-globe";
import { useThree, Canvas, extend } from "@react-three/fiber";
import type { ThreeElement } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import countries from "@/data/globe.json";

declare module "@react-three/fiber" {
  interface ThreeElements {
    threeGlobe: ThreeElement<typeof ThreeGlobe>;
  }
}

extend({ ThreeGlobe });

const RING_PROPAGATION_SPEED = 3;
const aspect = 1.2;
const cameraZ = 300;

type Position = {
  order: number;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  arcAlt: number;
  color: string;
};

type GlobePoint = {
  size: number;
  order: number;
  color: (t: number) => string;
  lat: number;
  lng: number;
};

export type GlobeConfig = {
  pointSize?: number;
  globeColor?: string;
  showAtmosphere?: boolean;
  atmosphereColor?: string;
  atmosphereAltitude?: number;
  emissive?: string;
  emissiveIntensity?: number;
  shininess?: number;
  polygonColor?: string;
  ambientLight?: string;
  directionalLeftLight?: string;
  directionalTopLight?: string;
  pointLight?: string;
  arcTime?: number;
  arcLength?: number;
  rings?: number;
  maxRings?: number;
  initialPosition?: {
    lat: number;
    lng: number;
  };
  autoRotate?: boolean;
  autoRotateSpeed?: number;
};

interface WorldProps {
  globeConfig: GlobeConfig;
  data: Position[];
}

let numbersOfRings = [0];

function isValidCoord(lat: unknown, lng: unknown) {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

function buildGlobePoints(data: Position[], pointSize: number): GlobePoint[] {
  const points: GlobePoint[] = [];

  for (const arc of data) {
    if (
      !arc ||
      !isValidCoord(arc.startLat, arc.startLng) ||
      !isValidCoord(arc.endLat, arc.endLng)
    ) {
      continue;
    }

    const rgb = hexToRgb(arc.color);
    if (!rgb) continue;

    const color = (t: number) => `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${1 - t})`;

    points.push(
      { size: pointSize, order: arc.order, color, lat: arc.startLat, lng: arc.startLng },
      { size: pointSize, order: arc.order, color, lat: arc.endLat, lng: arc.endLng },
    );
  }

  return points.filter(
    (point, index, all) =>
      all.findIndex((other) => other.lat === point.lat && other.lng === point.lng) === index,
  );
}

export function Globe({ globeConfig, data }: WorldProps) {
  const [globeData, setGlobeData] = useState<GlobePoint[] | null>(null);
  const globeRef = useRef<ThreeGlobe | null>(null);

  const defaultProps = useMemo(
    () => ({
      pointSize: 1,
      atmosphereColor: "#ffffff",
      showAtmosphere: true,
      atmosphereAltitude: 0.1,
      polygonColor: "rgba(255,255,255,0.7)",
      globeColor: "#1d072e",
      emissive: "#000000",
      emissiveIntensity: 0.1,
      shininess: 0.9,
      arcTime: 2000,
      arcLength: 0.9,
      rings: 1,
      maxRings: 3,
      ...globeConfig,
    }),
    [globeConfig],
  );

  useEffect(() => {
    if (!globeRef.current || data.length === 0) return;

    const globeMaterial = globeRef.current.globeMaterial() as unknown as {
      color: Color;
      emissive: Color;
      emissiveIntensity: number;
      shininess: number;
    };

    globeMaterial.color = new Color(globeConfig.globeColor);
    globeMaterial.emissive = new Color(globeConfig.emissive);
    globeMaterial.emissiveIntensity = globeConfig.emissiveIntensity || 0.1;
    globeMaterial.shininess = globeConfig.shininess || 0.9;

    setGlobeData(buildGlobePoints(data, defaultProps.pointSize));
  }, [data, defaultProps.pointSize, globeConfig]);

  useEffect(() => {
    if (!globeRef.current || !globeData || data.length === 0) return;

    const globe = globeRef.current;

    globe
      .hexPolygonsData(countries.features)
      .hexPolygonResolution(3)
      .hexPolygonMargin(0.85)
      .showAtmosphere(defaultProps.showAtmosphere)
      .atmosphereColor(defaultProps.atmosphereColor)
      .atmosphereAltitude(defaultProps.atmosphereAltitude)
      .hexPolygonColor(() => defaultProps.polygonColor);

    const validArcs = data.filter(
      (arc) =>
        arc &&
        isValidCoord(arc.startLat, arc.startLng) &&
        isValidCoord(arc.endLat, arc.endLng) &&
        typeof arc.arcAlt === "number" &&
        Number.isFinite(arc.arcAlt),
    );

    if (validArcs.length === 0) return;

    const validPoints = globeData
      .filter((point) => isValidCoord(point.lat, point.lng))
      .map((point) => ({
        ...point,
        color: typeof point.color === "function" ? point.color(0.5) : point.color,
      }));

    globe
      .arcsData(validArcs)
      .arcStartLat((d: object) => (d as Position).startLat)
      .arcStartLng((d: object) => (d as Position).startLng)
      .arcEndLat((d: object) => (d as Position).endLat)
      .arcEndLng((d: object) => (d as Position).endLng)
      .arcColor((d: object) => (d as Position).color)
      .arcAltitude((d: object) => (d as Position).arcAlt)
      .arcStroke(() => 0.28)
      .arcDashLength(defaultProps.arcLength)
      .arcDashInitialGap((d: object) => (d as Position).order)
      .arcDashGap(15)
      .arcDashAnimateTime(() => defaultProps.arcTime);

    if (validPoints.length > 0) {
      globe
        .pointsData(validPoints)
        .pointColor((d: object) => (d as { color: string }).color)
        .pointsMerge(true)
        .pointAltitude(0)
        .pointRadius(1.5);
    }

    const ringPeriod =
      defaultProps.rings > 0
        ? (defaultProps.arcTime * defaultProps.arcLength) / defaultProps.rings
        : 2000;

    globe
      .ringsData([])
      .ringColor((d: object) => (d as GlobePoint).color)
      .ringMaxRadius(defaultProps.maxRings)
      .ringPropagationSpeed(RING_PROPAGATION_SPEED)
      .ringRepeatPeriod(ringPeriod);
  }, [globeData, data, defaultProps]);

  useEffect(() => {
    if (!globeData || globeData.length === 0) return;

    const interval = setInterval(() => {
      if (!globeRef.current || globeData.length === 0) return;

      const ringCount = Math.max(1, Math.floor((globeData.length * 4) / 5));
      numbersOfRings = genRandomNumbers(0, globeData.length, ringCount);

      const validRingsData = globeData.filter((point, index) => {
        if (!numbersOfRings.includes(index)) return false;
        return isValidCoord(point.lat, point.lng);
      });

      globeRef.current.ringsData(validRingsData);
    }, 2000);

    return () => clearInterval(interval);
  }, [globeData]);

  return <threeGlobe ref={globeRef} />;
}

export function WebGLRendererConfig() {
  const { gl, size } = useThree();

  useEffect(() => {
    gl.setPixelRatio(window.devicePixelRatio);
    gl.setSize(size.width, size.height);
    gl.setClearColor(0xffaaff, 0);
  }, [gl, size.height, size.width]);

  return null;
}

export function World(props: WorldProps) {
  const { globeConfig } = props;
  const scene = new Scene();
  scene.fog = new Fog(0xffffff, 400, 2000);
  return (
    <Canvas scene={scene} camera={new PerspectiveCamera(50, aspect, 180, 1800)}>
      <WebGLRendererConfig />
      <ambientLight color={globeConfig.ambientLight} intensity={0.6} />
      <directionalLight
        color={globeConfig.directionalLeftLight}
        position={new Vector3(-400, 100, 400)}
      />
      <directionalLight
        color={globeConfig.directionalTopLight}
        position={new Vector3(-200, 500, 200)}
      />
      <pointLight
        color={globeConfig.pointLight}
        position={new Vector3(-200, 500, 200)}
        intensity={0.8}
      />
      <Globe {...props} />
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        minDistance={cameraZ}
        maxDistance={cameraZ}
        autoRotateSpeed={globeConfig.autoRotateSpeed ?? 1}
        autoRotate={globeConfig.autoRotate ?? true}
        minPolarAngle={Math.PI / 3.5}
        maxPolarAngle={Math.PI - Math.PI / 3}
      />
    </Canvas>
  );
}

export function hexToRgb(hex: string) {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const normalized = hex.replace(shorthandRegex, (_m, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(normalized);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

export function genRandomNumbers(min: number, max: number, count: number) {
  const range = max - min;
  if (range <= 0) return [min];

  const safeCount = Math.min(count, range);
  const arr: number[] = [];
  while (arr.length < safeCount) {
    const r = Math.floor(Math.random() * range) + min;
    if (!arr.includes(r)) arr.push(r);
  }

  return arr;
}
