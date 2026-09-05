import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/sections/hero";
import { How } from "@/components/sections/how";
import { Earn } from "@/components/sections/earn";
import { Adapters } from "@/components/sections/adapters";
import { Ledger } from "@/components/sections/ledger";
import { Faq } from "@/components/sections/faq";
import { Cta } from "@/components/sections/cta";
import { Footer } from "@/components/footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <How />
        <Earn />
        <Adapters />
        <Ledger />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
