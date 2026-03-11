varying vec3 vColor;
varying float vOpacity;
varying float vMorphProgress;
varying float vDepth;

void main() {
  // Morph from zinc color toward white as card forms
  vec3 white = vec3(1.0);
  vec3 finalColor = mix(vColor, white, vMorphProgress * 0.9);

  // Subtle depth-based fade (camera at Z=50, particles near Z=0, so depth ~45-55)
  // Only fade particles that are significantly further/closer than focal plane
  float fog = smoothstep(48.0, 58.0, vDepth);
  float finalOpacity = vOpacity * (1.0 - fog * 0.4);

  if (finalOpacity < 0.01) discard;

  gl_FragColor = vec4(finalColor, finalOpacity);
}
