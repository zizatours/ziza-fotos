export default function HomePage() {
  // Definimos algunos eventos de ejemplo
  const events = [
    { id: 1, name: "Concierto de Año Nuevo", city: "Santiago", date: "2025-12-31" },
    { id: 2, name: "Fiesta Privada", city: "Valparaíso", date: "2025-10-31" },
    // Agrega más eventos aquí
  ];

  return (
    <main className="min-h-screen bg-white">
      <section className="max-w-3xl mx-auto text-center px-6 pt-24 pb-16">
        <h1 className="text-5xl font-semibold text-gray-900 mb-4">
          Encuentra tus fotos del evento
        </h1>
        <p className="text-lg text-gray-600">
          Selecciona tu evento para comenzar
        </p>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
          {/* Agregar las cards de los eventos */}
          {events.map((event) => (
            <div
              key={event.id}
              className="bg-gray-100 p-6 rounded-lg shadow-md cursor-pointer"
              onClick={() => alert(`Seleccionaste el evento: ${event.name}`)} // Esto simula el clic
            >
              <h2 className="text-xl font-semibold text-gray-900">{event.name}</h2>
              <p className="text-gray-600">{event.city}</p>
              <p className="text-gray-400">{event.date}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}