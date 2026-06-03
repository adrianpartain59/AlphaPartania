import { Environment, Lightformer } from '@react-three/drei'

/**
 * Minimal lighting. The blue sun (its own point light) does most of the work;
 * here we add a faint ambient floor plus a procedural Environment (Lightformers,
 * no HDR download) purely so the glass cores have something cool and bluish to
 * refract and reflect. The gyroscope rings are unlit by design, so none of this
 * touches them.
 */
export default function Lighting() {
  return (
    <>
      <ambientLight intensity={0.25} />

      <Environment resolution={256} frames={1}>
        <color attach="background" args={['#05080f']} />
        <Lightformer
          form="rect"
          intensity={2}
          color="#2f9dff"
          scale={[14, 6, 1]}
          position={[0, 8, -10]}
        />
        <Lightformer
          form="circle"
          intensity={2.6}
          color="#7fc8ff"
          scale={6}
          position={[-10, 2, 6]}
        />
        <Lightformer
          form="circle"
          intensity={2}
          color="#46d6ff"
          scale={6}
          position={[10, -2, 6]}
        />
      </Environment>
    </>
  )
}
