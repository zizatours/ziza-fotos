"use client"; // Esto es necesario para habilitar interactividad

import React from "react";

export default function HomePage() {
  const events = [
    { id: 1, name: "Concierto de Año Nuevo", city: "Santiago", date: "2025-12-31" },
    { id: 2, name: "Fiesta Privada", city: "Valparaíso", date: "2025-10-31" },
    // Puedes agregar más eventos aquí
  ];

  return (
    <main className="min-h-screen bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500">
      <section className="max-w-5xl mx-auto text-center px-6 pt-24 pb-16">
        <h1 className="text-5xl font-bold text-white mb-4">
          Encuentra tus fotos del evento
        </h1>
        <p className="text-xl text-white mb-8">
          Selecciona tu evento para comenzar la búsqueda
        </p>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
          {events.map((event) => (
            <div
              key={event.id}
              className="bg-white p-6 rounded-xl shadow-lg transform hover:scale-105 transition-all duration-300 cursor-pointer"
              onClick={() => alert(`Seleccionaste el evento: ${event.name}`)}
            >
              <h2 className="text-2xl font-semibold text-gray-900">{event.name}</h2>
              <p className="text-gray-600 text-lg">{event.city}</p>
              <p className="text-gray-500 text-sm">{event.date}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}