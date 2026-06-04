import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { attachBubbleDistortionTimeline } from './bubbleDistortionTimeline'
import { systemAnchor } from './systemAnchor'

const BUBBLE_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const BUBBLE_FRAGMENT = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform float uIntensity;
  uniform vec2 uLensCenter;
  varying vec2 vUv;

  void main() {
    vec2 c = vUv - uLensCenter;
    float r2 = dot(c, c);
    float r = sqrt(r2);
    float i = uIntensity;

    // Convex lens / bubble: pull sample coords toward the lens centre so the
    // scene magnifies and the light bends strongly outward from the centre, as
    // if a glass sphere is bulging toward the camera. exp() keeps the scaling
    // positive (never flips) even at very high intensity, so we can crank it.
    // The quadratic term makes the bend ramp up toward the edges of the frame.
    float kR = i * (0.16 + 1.05 * r2);
    float kG = i * (0.19 + 0.96 * r2);
    float kB = i * (0.22 + 0.87 * r2);

    // Full-plate shimmer (small, symmetric — not a pan)
    float ripple = sin(r * 26.0) * i * 0.012 * (0.25 + r);
    vec2 dir = r > 1e-4 ? c / r : vec2(0.0);
    vec2 rip = dir * ripple;

    vec2 uvR = clamp(uLensCenter + c * exp(-kR) + rip, 0.002, 0.998);
    vec2 uvG = clamp(uLensCenter + c * exp(-kG) + rip, 0.002, 0.998);
    vec2 uvB = clamp(uLensCenter + c * exp(-kB) + rip, 0.002, 0.998);

    gl_FragColor = vec4(
      texture2D(tDiffuse, uvR).r,
      texture2D(tDiffuse, uvG).g,
      texture2D(tDiffuse, uvB).b,
      texture2D(tDiffuse, uvG).a
    );
  }
`

const BubbleDistortionShader = {
  uniforms: {
    tDiffuse: { value: null },
    uIntensity: { value: 0 },
    uLensCenter: { value: new THREE.Vector2(0.5, 0.5) },
  },
  vertexShader: BUBBLE_VERTEX,
  fragmentShader: BUBBLE_FRAGMENT,
}

const VignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    offset: { value: 0.25 },
    darkness: { value: 0.7 },
  },
  vertexShader: BUBBLE_VERTEX,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float offset;
    uniform float darkness;
    varying vec2 vUv;

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec2 uv = (vUv - vec2(0.5)) * vec2(offset + 1.0);
      float vig = clamp(1.0 - dot(uv, uv), 0.0, 1.0);
      texel.rgb *= mix(1.0 - darkness, 1.0, vig);
      gl_FragColor = texel;
    }
  `,
}

/**
 * Post-processing for the canvas: scene render → bubble refraction → bloom →
 * vignette. Uses raw three.js EffectComposer / ShaderPass (no displacement map).
 *
 * Pass `ref` to access `ref.current.uniforms.uIntensity` from outside, or rely
 * on the built-in GSAP pass-through timeline.
 */
const BubbleDistortionPass = forwardRef(function BubbleDistortionPass(_, ref) {
  const composerRef = useRef(null)
  const bubblePassRef = useRef(null)
  const { gl, scene, camera, size } = useThree()

  useImperativeHandle(ref, () => bubblePassRef.current, [])

  useLayoutEffect(() => {
    // Multisampled target so geometry edges stay crisp through the chain,
    // matching the AA quality of the previous postprocessing pipeline.
    const drawing = gl.getDrawingBufferSize(new THREE.Vector2())
    const renderTarget = new THREE.WebGLRenderTarget(drawing.x, drawing.y, {
      type: THREE.HalfFloatType,
      samples: 4,
    })

    const composer = new EffectComposer(gl, renderTarget)
    composer.addPass(new RenderPass(scene, camera))

    const bubblePass = new ShaderPass(BubbleDistortionShader)
    bubblePassRef.current = bubblePass
    composer.addPass(bubblePass)

    const resolution = new THREE.Vector2(size.width, size.height)
    const bloomPass = new UnrealBloomPass(resolution, 0.8, 0.7, 1.0)
    composer.addPass(bloomPass)

    composer.addPass(new ShaderPass(VignetteShader))
    composerRef.current = composer

    return () => {
      composer.dispose()
      composerRef.current = null
      bubblePassRef.current = null
    }
  }, [gl, scene, camera])

  useLayoutEffect(() => {
    const composer = composerRef.current
    if (!composer) return
    composer.setSize(size.width, size.height)
    composer.setPixelRatio(gl.getPixelRatio())
  }, [gl, size.width, size.height])

  const intensityRef = useRef({ value: 0 })

  useEffect(() => attachBubbleDistortionTimeline(intensityRef.current), [])

  useFrame((_, delta) => {
    const pass = bubblePassRef.current
    if (pass?.uniforms) {
      pass.uniforms.uIntensity.value = intensityRef.current.value
      const center = pass.uniforms.uLensCenter.value
      if (systemAnchor.ready && size.width > 0 && size.height > 0) {
        center.x = systemAnchor.x / size.width
        center.y = 1.0 - systemAnchor.y / size.height
      } else {
        center.set(0.5, 0.5)
      }
    }
    composerRef.current?.render(delta)
  }, 1)

  return null
})

export default BubbleDistortionPass
