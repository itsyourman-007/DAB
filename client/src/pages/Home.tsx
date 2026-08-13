import landingHtml from "../embedded/index.html?raw";

export default function Home() {
  return (
    <main className="h-screen bg-[#fbfaf7]">
      <iframe
        title="91DAB landing page"
        srcDoc={landingHtml}
        className="h-full w-full border-0 bg-[#fbfaf7]"
      />
    </main>
  );
}
