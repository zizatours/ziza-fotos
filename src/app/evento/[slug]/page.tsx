"use client";

import { useState } from "react";

/* FOTOS DEMO */
const fakePhotos = [
  "/fotos/1.jpg",
  "/fotos/2.jpg",
  "/fotos/3.jpg",
  "/fotos/4.jpg",
  "/fotos/5.jpg",
  "/fotos/6.jpg",
];

export default function EventoPage({
  params,
}: {
  params: { slug: string };
}) {
  const { slug } = params;

  const event = {
    title: "Ziza Tour Enero",
    city: "Santiago",
    date: "12 Enero 2025",
  };

  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "ready" | "loading" | "done">(
    "idle"
  );
  const [selected, setSelected] = useState<string[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setStatus("ready");
    }
  };

  const handleSearch = () => {
    if (!file) return;
    setStatus("loading");

    setTimeout(() => {
      setStatus("done");
    }, 2000);
  };

  const togglePhoto = (src: string) => {
    setSelected((prev) =>
      prev.includes(src) ? prev.filter((p) => p !== src) : [...prev, src]
    );
  };

  return (
    <main className="min-h-screen bg-white px-6 py-20">
      <section className="max-w-3xl mx-auto text-center mb-14">
        <h1 className="text-4xl font-semibold text-gray-900 mb-2">
          {event.title}
        </h1>
        <p className="text-gray-600">
          {event.city} · {event.date}
        </p>
      </section>

      {status !== "done" && (
        <div className="max-w-md mx-auto border rounded-xl p-6 text-center">
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="mb-4"
          />

          <button
            onClick={handleSearch}
            disabled={status !== "ready"}
            className="w-full py-2 rounded bg-black text-white disabled:bg-gray-300"
          >
            {status === "loading" ? "Buscando…" : "Buscar mis fotos"}
          </button>
        </div>
      )}

      {status === "done" && (
        <section className="max-w-5xl mx-auto">
          <h2 className="text-xl font-medium mb-6 text-center">
            Encontramos tus fotos
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {fakePhotos.map((src) => (
              <div
                key={src}
                onClick={() => togglePhoto(src)}
                className={`cursor-pointer border rounded overflow-hidden ${
                  selected.includes(src)
                    ? "ring-2 ring-black"
                    : "hover:shadow"
                }`}
              >
                <img src={src} className="w-full h-48 object-cover" />
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}