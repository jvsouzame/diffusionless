export const VERT = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`

const COMMON = `#version 300 es
precision highp float;
precision highp int;
uniform int uModel;
uniform vec2 uRes;
uniform int uSeed;
// Which of the three species a brush stroke lays down in the cyclic model.
uniform int uPhase;

uint pcg(uint v) {
  uint s = v * 747796405u + 2891336453u;
  uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return (w >> 22u) ^ w;
}
float hash3(ivec2 p, int z) {
  uint h = pcg(uint(p.x) + pcg(uint(p.y) + pcg(uint(z))));
  return float(h) / 4294967295.0;
}
vec3 hashv(ivec2 p, int z) {
  return vec3(hash3(p, z), hash3(p, z + 7919), hash3(p, z + 15838));
}
// Value noise on a wrapping lattice, so it tiles across the grid.
float vnoise(vec2 uv, ivec2 freq, int z) {
  vec2 p = uv * vec2(freq);
  ivec2 i = ivec2(floor(p));
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  ivec2 i0 = ((i % freq) + freq) % freq;
  ivec2 i1 = (i0 + 1) % freq;
  float a = hash3(i0, z);
  float b = hash3(ivec2(i1.x, i0.y), z);
  float c = hash3(ivec2(i0.x, i1.y), z);
  float d = hash3(i1, z);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 uv, ivec2 freq, int z) {
  return vnoise(uv, freq, z) * 0.6 + vnoise(uv, freq * 2, z + 101) * 0.3 + vnoise(uv, freq * 4, z + 202) * 0.1;
}
ivec2 noiseFreq(int scale) {
  float m = max(uRes.x, uRes.y);
  return max(ivec2(1), ivec2(round(float(scale) * uRes / m)));
}
// Gray-Scott rests on an empty field. The other two need variation everywhere:
// FitzHugh-Nagumo gets smooth offset fields (their crossings become spiral cores)
// and Belousov-Zhabotinsky gets white noise, since it cannot grow out of zeros.
vec4 baseState(ivec2 p) {
  if (uModel == 0) return vec4(1.0, 0.0, 0.0, 1.0);
  if (uModel == 1) {
    vec2 uv = (vec2(p) + 0.5) / uRes;
    ivec2 fq = noiseFreq(5);
    return vec4(0.9 * (fbm(uv, fq, uSeed + 41) * 2.0 - 1.0), 0.6 * (fbm(uv, fq, uSeed + 83) * 2.0 - 1.0), 0.0, 1.0);
  }
  return vec4(hashv(p, uSeed + 5), 1.0);
}
vec4 seededState(ivec2 p) {
  if (uModel == 0) return vec4(0.5, 1.0, 0.0, 1.0);
  if (uModel == 1) return vec4(1.0, -0.2, 0.0, 1.0);
  // Each stroke lays the next species in the cycle, so strokes that meet curl into spirals.
  if (uPhase == 1) return vec4(0.0, 1.0, 0.0, 1.0);
  if (uPhase == 2) return vec4(0.0, 0.0, 1.0, 1.0);
  return vec4(1.0, 0.0, 0.0, 1.0);
}
`

export const SIM_FRAG = `${COMMON}
uniform sampler2D uState;
uniform float uP[8];
uniform vec4 uPadRange;
uniform float uJitter;
uniform float uField;
uniform int uFieldScale;
uniform int uStep;
uniform bool uMap;
out vec4 o;

void main() {
  ivec2 ip = ivec2(gl_FragCoord.xy);
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 px = 1.0 / uRes;
  vec4 c = texture(uState, uv);
  vec4 n4 = texture(uState, uv + vec2(px.x, 0.0)) + texture(uState, uv - vec2(px.x, 0.0))
          + texture(uState, uv + vec2(0.0, px.y)) + texture(uState, uv - vec2(0.0, px.y));
  vec4 d4 = texture(uState, uv + px) + texture(uState, uv - px)
          + texture(uState, uv + vec2(px.x, -px.y)) + texture(uState, uv + vec2(-px.x, px.y));
  vec4 lap = 0.2 * n4 + 0.05 * d4 - c;

  float p0 = uP[0];
  float p1 = uP[1];
  if (uMap) {
    p0 = mix(uPadRange.x, uPadRange.y, uv.x);
    p1 = mix(uPadRange.z, uPadRange.w, uv.y);
  }
  if (uField > 0.0) {
    ivec2 fq = noiseFreq(uFieldScale);
    p0 += uField * 0.25 * (uPadRange.y - uPadRange.x) * (fbm(uv, fq, uSeed + 11) * 2.0 - 1.0);
    p1 += uField * 0.25 * (uPadRange.w - uPadRange.z) * (fbm(uv, fq, uSeed + 57) * 2.0 - 1.0);
  }

  vec4 r = c;
  vec3 jitter = hashv(ip, uSeed * 131 + uStep) - 0.5;
  if (uModel == 0) {
    float A = c.r;
    float B = c.g;
    float rr = A * B * B;
    r.r = A + uP[2] * lap.r - rr + p1 * (1.0 - A);
    r.g = B + uP[3] * lap.g + rr - (p0 + p1) * B;
    r.rg += uJitter * 0.05 * jitter.rg;
    r.rg = clamp(r.rg, 0.0, 1.0);
  } else if (uModel == 1) {
    float Du = uP[3];
    float Dv = uP[4];
    float dt = min(0.2, 1.0 / (1.6 * max(max(Du, Dv), 0.001)));
    float u = c.r;
    float v = c.g;
    r.r = u + dt * (Du * lap.r + u - u * u * u - v);
    r.g = v + dt * (Dv * lap.g + uP[2] * (u - p1 * v - p0));
    r.rg += uJitter * 0.6 * dt * jitter.rg;
    r.rg = clamp(r.rg, -2.0, 2.0);
  } else {
    // Three species in cyclic competition: each is suppressed weakly (alpha) by the
    // next one and strongly (beta) by the one after, which rolls up into spiral waves.
    // The rate slider is scaled down so the model unfolds slowly at the default speed.
    // Diffusion and reaction share the step, so the pattern keeps its shape and only its pace changes.
    float dt = uP[3] * 0.1;
    vec3 s = c.rgb;
    r.rgb = s + dt * (uP[2] * lap.rgb + s * (1.0 - s - p0 * s.gbr - p1 * s.brg));
    r.rgb += uJitter * 0.2 * dt * jitter;
    r.rgb = clamp(r.rgb, 0.0005, 1.0);
  }
  o = r;
}`

export const SEED_FRAG = `${COMMON}
uniform int uPattern;
uniform int uShape;
uniform float uDensity;
uniform float uSize;
uniform bool uInvert;
uniform sampler2D uImage;
uniform vec2 uImageSize;
out vec4 o;

float spots(vec2 p) {
  float n = mix(2.0, 28.0, uDensity);
  float cell = max(uRes.x, uRes.y) / n;
  ivec2 nc = max(ivec2(1), ivec2(round(uRes / cell)));
  vec2 cs = uRes / vec2(nc);
  ivec2 id = ivec2(floor(p / cs));
  float m = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      ivec2 q = id + ivec2(i, j);
      ivec2 qw = ((q % nc) + nc) % nc;
      vec2 ctr = (vec2(q) + 0.15 + 0.7 * vec2(hash3(qw, uSeed), hash3(qw, uSeed + 31))) * cs;
      if (hash3(qw, uSeed + 77) < 0.75 && distance(p, floor(ctr) + 0.5) <= max(uSize * 0.5, 0.5)) m = 1.0;
    }
  }
  return m;
}

float shape(vec2 p) {
  vec2 c = uRes * 0.5;
  float minR = min(uRes.x, uRes.y);
  float r = max(uSize * 0.5, 0.71);
  float period = max(uSize + 2.0, floor(minR / mix(2.0, 16.0, uDensity)));
  if (uShape == 0) return step(distance(p, c), r);
  if (uShape == 1) return step(abs(distance(p, c) - minR * 0.3), r);
  if (uShape == 2) {
    float lx = mod(p.x - c.x + period * 0.5, period) - period * 0.5;
    return step(abs(lx), max(uSize * 0.5, 0.5));
  }
  vec2 g = mod(p - c + period * 0.5, period) - period * 0.5;
  return step(length(g), r);
}

float image(vec2 uv) {
  float ga = uRes.x / uRes.y;
  float ia = uImageSize.x / uImageSize.y;
  vec2 s = ga > ia ? vec2(ga / ia, 1.0) : vec2(1.0, ia / ga);
  vec2 iuv = (uv - 0.5) * s + 0.5;
  if (any(lessThan(iuv, vec2(0.0))) || any(greaterThan(iuv, vec2(1.0)))) return 0.0;
  vec4 t = texture(uImage, iuv);
  float lum = dot(t.rgb, vec3(0.299, 0.587, 0.114));
  return step(0.5, (1.0 - lum) * t.a);
}

void main() {
  vec2 p = gl_FragCoord.xy;
  vec2 uv = p / uRes;
  ivec2 ip = ivec2(p);
  if (uPattern == 4) { o = baseState(ip); return; }
  float m = 0.0;
  if (uPattern == 0) m = spots(p);
  else if (uPattern == 1) m = shape(p);
  else if (uPattern == 2) m = step(1.0 - uDensity, fbm(uv, noiseFreq(10), uSeed + 3));
  else m = image(uv);
  if (uInvert) m = 1.0 - m;
  o = mix(baseState(ip), seededState(ip), m);
}`

export const BRUSH_FRAG = `${COMMON}
uniform sampler2D uState;
uniform vec2 uA;
uniform vec2 uB;
uniform float uRadius;
uniform bool uErase;
uniform bool uWrap;
out vec4 o;

void main() {
  vec2 p = gl_FragCoord.xy;
  vec2 pa = p - uA;
  if (uWrap) pa = mod(pa + uRes * 0.5, uRes) - uRes * 0.5;
  vec2 ba = uB - uA;
  float l = dot(ba, ba);
  float h = l > 0.0 ? clamp(dot(pa, ba) / l, 0.0, 1.0) : 0.0;
  float d = length(pa - ba * h);
  vec4 c = texture(uState, p / uRes);
  if (d <= uRadius) c = uErase ? baseState(ivec2(p)) : seededState(ivec2(p));
  o = c;
}`

export const DISPLAY_FRAG = `${COMMON}
uniform sampler2D uState;
uniform vec3 uPal[8];
uniform int uCount;
uniform float uContrast;
uniform float uOffset;
uniform bool uInvert;
uniform float uDither;
uniform int uBayer;
uniform float uGrain;
uniform int uGrainFrame;
out vec4 o;

float bayer(ivec2 p, int n) {
  int levels = n == 2 ? 1 : (n == 4 ? 2 : 3);
  int v = 0;
  for (int i = 0; i < levels; i++) {
    int xb = (p.x >> i) & 1;
    int yb = (p.y >> i) & 1;
    v = (v << 2) | ((xb ^ yb) << 1) | yb;
  }
  return (float(v) + 0.5) / float(n * n);
}

void main() {
  ivec2 ip = ivec2(gl_FragCoord.xy);
  vec4 c = texture(uState, gl_FragCoord.xy / uRes);
  float t;
  if (uModel == 0) t = c.g * 2.5;
  else if (uModel == 1) t = (c.r + 1.1) / 2.2;
  else t = c.r;
  t = (clamp(t, 0.0, 1.0) - 0.5) * uContrast + 0.5 + uOffset;
  if (uInvert) t = 1.0 - t;
  float n = float(uCount);
  float q = t * n
    + (bayer(ip, uBayer) - 0.5) * uDither
    + (hash3(ip, uSeed + 900 + uGrainFrame) - 0.5) * uGrain * 2.0;
  int idx = clamp(int(floor(q)), 0, uCount - 1);
  o = vec4(uPal[idx], 1.0);
}`
