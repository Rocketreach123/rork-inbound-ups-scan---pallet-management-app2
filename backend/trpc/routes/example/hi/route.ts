import { z } from "zod";
import { publicProcedure } from "@/backend/trpc/create-context";

export const hiProcedure = publicProcedure
  .input(z.object({ name: z.string() }))
  .query(({ input }: { input: { name: string } }) => {
    return {
      hello: input.name,
      date: new Date(),
    };
  });