"use client";

import Link from "next/link";

export default function HomePage() {
  const events = [
    {
      id: 1,
      title: "Ziza Tour Enero",
      city: "Santiago",
      date: "12 Enero 2025",
      slug: "demo",
    },
    {
      id: 2,
      title: "Ziza Tour Verano",
      city: "Valparaíso",
      date: "28 Febrero 2025",
      slug: "demo",
    },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500">
      {/* HERO */}
      <section className="max-w-5xl mx-auto text-center px-6 pt-24 pb-16">
        <h1 className="text-5xl font-bold text-white mb-4">
          Encuentra tus fotos del evento
        </h1>
        <p className="text-xl text-white/90">
          Selecciona tu evento para comenzar
        </p>
      </section>

      {/* EVENTOS */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
          {events.map((event) => (
            <Link
              key={event.id}
              href={`/evento/${event.slug}`}
              className="bg-white p-6 rounded-xl shadow-lg hover:scale-105 transition-transform duration-300 cursor-pointer"
            >
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                {event.title}
              </h2>
              <p className="text-gray-600">{event.city}</p>
              <p className="text-gray-400 text-sm">{event.date}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}