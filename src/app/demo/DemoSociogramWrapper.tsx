"use client"

import dynamic from "next/dynamic"

const DemoSociogramClient = dynamic(() => import("./DemoSociogram"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full text-sm text-gray-400">
      Cargando sociograma…
    </div>
  ),
})

export default function DemoSociogramWrapper() {
  return <DemoSociogramClient />
}
