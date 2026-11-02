import type { Metadata } from "next";
import { Benchmark } from "@/components/benchmark";

export const metadata: Metadata = { title: "Benchmark · Anonimizador", robots: { index: false } };

export default function BenchmarkPage() {
  return <Benchmark />;
}
