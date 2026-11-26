import { lazy, Suspense } from 'react'
import { Navbar } from '@/components/layout/Navbar'
import { CustomCursor } from '@/features/custom-cursor/CustomCursor'
import { ParticleBackground } from '@/features/particle-background/ParticleBackground'
import { NetworkSvg } from '@/features/technology-network/NetworkSvg'
import { About } from '@/sections/About'
import { Hero } from '@/sections/Hero/Hero'
import { ProfessionalStatus } from '@/sections/ProfessionalStatus'
import { TechnologyStack } from '@/sections/TechnologyStack'
import { Experience } from '@/sections/Experience'
import { SelectedProjects } from '@/sections/SelectedProjects'
import { Contact } from '@/sections/Contact'

const SurfaceDebugOverlay = import.meta.env.DEV
  ? lazy(() =>
      import('@/features/robot-surfaces/SurfaceDebugOverlay').then((m) => ({
        default: m.SurfaceDebugOverlay,
      })),
    )
  : null

export default function App() {
  return (
    <div className="isolate">
      <CustomCursor />
      <ParticleBackground />
      <Navbar />
      <main
        id="top"
        aria-label="Portfolio application"
        className="scroll-mt-16"
      >
        <Hero network={<NetworkSvg />} />
        <ProfessionalStatus />
        <About />
        <TechnologyStack />
        <Experience />
        <SelectedProjects />
        <Contact />
      </main>
      {SurfaceDebugOverlay && (
        <Suspense fallback={null}>
          <SurfaceDebugOverlay />
        </Suspense>
      )}
    </div>
  )
}
