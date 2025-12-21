export default function HomePage() {
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
          {/* Aquí van las cards de eventos */}
        </div>
      </section>
    </main>
  );
}