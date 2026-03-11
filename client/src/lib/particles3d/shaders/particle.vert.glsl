// Per-instance attributes
attribute vec3 aColor;
attribute float aOpacity;
attribute float aMorphProgress;

varying vec3 vColor;
varying float vOpacity;
varying float vMorphProgress;
varying float vDepth;

void main() {
  vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  vColor = aColor;
  vOpacity = aOpacity;
  vMorphProgress = aMorphProgress;
  vDepth = -mvPosition.z;
}
