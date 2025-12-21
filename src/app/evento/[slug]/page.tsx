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

export default function EventoPage() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<
    "idle" | "ready" | "loading" | "done"
  >("idle");
  const [selected, setSelected] = useState<string[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus("ready");
    }
  };

  const handleSearch = () => {
    if (!file) return;
    setStatus("loading");

    // Simulación backend
    setTimeout(() => {
      setStatus("done");
    }, 2000);
  };
  const togglePhoto = (src: string) => {
    setSelected((prev) =>
      prev.includes(src)
        ? prev.filter((p) => p !== src)
        : [...prev, src]
    );
  };

  return (
    <main className="min-h-screen bg-white">

      {/* HERO */}
      <section
        className="relative h-[60vh] flex items-center justify-center"
        style={{
          backgroundImage: "url('/evento.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative text-center text-white px-6 max-w-2xl">
          <h1 className="text-5xl font-semibold mb-3">
            Nombre del Evento
          </h1>
          <p className="text-lg opacity-90">
            Sube una selfie y encuentra tus fotos oficiales
          </p>
        </div>
      </section>

      {/* INFO EVENTO */}
      <section className="max-w-3xl mx-auto flex justify-center gap-10 text-sm my-10 text-gray-900">
        <span>📍 Santiago de Chile</span>
        <span>📅 12 Oct 2025</span>
        <span>📸 Fotos oficiales</span>
      </section>

      {/* UPLOAD / RESULTADOS */}
      <section className="max-w-5xl mx-auto px-6 my-16">

        {/* SUBIR SELFIE */}
        {status !== "done" && (
          <div className="max-w-md mx-auto border border-gray-200 rounded-2xl p-8 text-center">
            <h2 className="text-2xl font-medium mb-2 text-gray-900">
              Sube tu selfie
            </h2>

            <p className="text-sm text-gray-600 mb-6">
              Usamos reconocimiento facial para mostrarte solo tus fotos
            </p>

            <input
              id="selfie"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            <label
              htmlFor="selfie"
              className="block w-full cursor-pointer rounded-full border border-gray-300 py-3 text-sm text-gray-700 hover:bg-gray-100 transition mb-4"
            >
              {file ? "Selfie seleccionada ✓" : "Seleccionar selfie"}
            </label>

            <button
              onClick={handleSearch}
              disabled={status !== "ready"}
              className={`w-full py-3 rounded-full text-sm font-medium transition
                ${
                  status === "ready"
                    ? "bg-black text-white hover:bg-gray-900"
                    : "bg-gray-200 text-gray-500"
                }`}
            >
              {status === "loading" ? "Buscando…" : "Buscar mis fotos"}
            </button>

            {status === "loading" && (
              <p className="text-sm text-gray-700 mt-4">
                Analizando tu imagen…
              </p>
            )}

            <p className="text-xs text-gray-500 mt-6">
              Tu imagen no se publica ni se guarda
            </p>
          </div>
        )}

        {/* RESULTADOS */}
        {status === "done" && (
          <>
            <h2 className="text-2xl font-medium text-gray-900 mb-6 text-center">
              Encontramos tus fotos
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {fakePhotos.map((src, i) => {
                const isSelected = selected.includes(src);

                return (
                  <div
                    key={i}
                    onClick={() => togglePhoto(src)}
                    className={`relative rounded-xl overflow-hidden border cursor-pointer transition
                      ${
                        isSelected
                          ? "border-black ring-2 ring-black"
                          : "border-gray-200 hover:shadow-md"
                      }`}
                  >
                    <img
                      src={src}
                      alt="Foto del evento"
                      className="w-full h-64 object-cover"
                    />

                    {isSelected && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="text-white text-3xl font-bold">✓</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex flex-col items-center mt-10 gap-4">
              <p className="text-sm text-gray-700">
                {selected.length === 0
                  ? "Selecciona tus fotos favoritas"
                  : `${selected.length} foto${selected.length > 1 ? "s" : ""} seleccionada${selected.length > 1 ? "s" : ""}`}
              </p>

              <button
                disabled={selected.length === 0}
                className={`px-8 py-3 rounded-full text-sm font-medium transition
                  ${
                    selected.length > 0
                      ? "bg-black text-white hover:bg-gray-900"
                      : "bg-gray-200 text-gray-500 cursor-not-allowed"
                  }`}
              >
                Comprar fotos seleccionadas
              </button>
            </div>
          </>
        )}

      </section>

    </main>
  );
}