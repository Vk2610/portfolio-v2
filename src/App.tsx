import { Navbar } from '@/components/layout/Navbar'
import { NetworkSvg } from '@/features/technology-network/NetworkSvg'
import { Hero } from '@/sections/Hero/Hero'

export default function App() {
  return (
    <>
      <Navbar />
      <main
        id="top"
        aria-label="Portfolio application"
        className="scroll-mt-16"
      >
        <Hero network={<NetworkSvg />} />
      </main>
    </>
  )
}
