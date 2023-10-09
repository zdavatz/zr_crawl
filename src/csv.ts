import { writeCSVObjects } from "https://deno.land/x/csv@v0.9.2/mod.ts";
import { Product } from "./types.ts";

const header = [
  // 'hash',
  "category",
  "name",
  "packageSize",
  "cumulusPoints",
  "price",
  "reducedPrice",
  "company",
  "shippingCosts",
  "images",
  "link",
];

export async function writeCSV(
  outputFile: string,
  generator: AsyncGenerator<Product, void, void>,
): Promise<void> {
  const f = await Deno.open(outputFile, {
    write: true,
    create: true,
    truncate: true,
  });
  await writeCSVObjects(f, generator, { header });
}
