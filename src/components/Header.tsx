import Link from 'next/link'

export default function Header() {
  return (
    <header className="border-b bg-white">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-6">
        <Link href="/" className="font-semibold text-lg">
          Logo
        </Link>

        <Link href="/" className="text-sm text-gray-700 hover:text-black">
          Inicio
        </Link>
      </div>
    </header>
  )
}
