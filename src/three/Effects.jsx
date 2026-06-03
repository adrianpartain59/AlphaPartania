import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'

/**
 * Post-processing that sells the "neon in the dark" aesthetic.
 *
 * Bloom only blooms what's genuinely bright: the wireframe cages and logos are
 * rendered with `toneMapped={false}` and a high emissive intensity, so their
 * colour values exceed the luminance threshold and glow, while the dim
 * starfield stays crisp. A soft vignette focuses the eye toward the centre.
 */
export default function Effects() {
  return (
    <EffectComposer disableNormalPass multisampling={4}>
      <Bloom
        mipmapBlur
        intensity={0.8}
        luminanceThreshold={1.0}
        luminanceSmoothing={0.2}
        radius={0.7}
      />
      <Vignette eskil={false} offset={0.25} darkness={0.7} />
    </EffectComposer>
  )
}
