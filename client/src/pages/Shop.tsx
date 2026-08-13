import shopHtml from "../embedded/shop.html?raw";

export default function Shop() {
  return (
    <main className="h-screen bg-[#fbfaf7]">
      <iframe title="91DAB storefront" srcDoc={shopHtml} className="h-full w-full border-0 bg-[#fbfaf7]" />
    </main>
  );
}
