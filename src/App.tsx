import { Navbar } from '@/components/layout/Navbar'
import { ParticleBackground } from '@/features/particle-background/ParticleBackground'
import { NetworkSvg } from '@/features/technology-network/NetworkSvg'
import { About } from '@/sections/About'
import { Hero } from '@/sections/Hero/Hero'
import { ProfessionalStatus } from '@/sections/ProfessionalStatus'

export default function App() {
  return (
    <div className="isolate">
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
      </main>
    </div>
  )
}
