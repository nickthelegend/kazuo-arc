import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/sections/hero";
import { Stats } from "@/components/sections/stats";
import { How } from "@/components/sections/how";
import { Earn } from "@/components/sections/earn";
import { Payments } from "@/components/sections/payments";
import { Adapters } from "@/components/sections/adapters";
import { Faq } from "@/components/sections/faq";
import { Cta } from "@/components/sections/cta";
import { Footer } from "@/components/footer";

export default function Home() {
  return (
    <main className="relative">
      <Navbar />
      <Hero />
      <Stats />
      <How />
      <Earn />
      <Payments />
      <Adapters />
      <Faq />
      <Cta />
      <Footer />
    </main>
  );
}
