import { Suspense } from "react"
import { Loading } from "@/components/ui/loading"
import SearchClient from "./search-client"

export default function SearchPage() {
  return (
    <Suspense fallback={<Loading message="Searching..." />}>
      <SearchClient />
    </Suspense>
  )
}