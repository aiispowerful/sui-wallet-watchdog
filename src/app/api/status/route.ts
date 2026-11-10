import { connection } from "next/server";
import { integrationStatus } from "@/lib/server";

export async function GET() {
  await connection(); // read env at request time, never at build time
  return Response.json(integrationStatus());
}
