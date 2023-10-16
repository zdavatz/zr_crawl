import { writeCSVObjects } from "https://deno.land/x/csv@v0.9.2/mod.ts";
import { encodeHex } from "https://deno.land/std@0.202.0/encoding/hex.ts";
// @deno-types="npm:@types/highland"
import Highland from "npm:highland@2.13.5";

import { CsvRow, Product } from "./types.ts";
import { toGenerator } from "./utilities.ts";

const productHeader = [
  "hash",
  "category",
  "fullCategory",
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

async function hashProduct(product: Product): Promise<string> {
  let message = "";
  message += product.category;
  message += product.fullCategory;
  message += product.name;
  message += product.packageSize;
  message += product.cumulusPoints;
  message += product.price;
  message += product.reducedPrice;
  message += product.company;
  message += product.shippingCosts;
  message += product.images;
  message += product.link;
  const messageBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", messageBuffer);
  const hash = encodeHex(hashBuffer);
  return hash;
}

async function addHash(product: Product): Promise<CsvRow> {
  return {
    ...product,
    hash: await hashProduct(product),
  };
}

export async function writeProductCSV(
  outputFile: string,
  products: Highland.Stream<Product>,
): Promise<void> {
  return await writeCSV(
    outputFile,
    productHeader,
    products.flatMap((p) => Highland(addHash(p))),
  );
}

export async function writeCSV<T extends { [key: string]: string }>(
  outputFile: string,
  header: string[],
  items: Highland.Stream<T>,
): Promise<void> {
  const f = await Deno.open(outputFile, {
    write: true,
    create: true,
    truncate: true,
  });
  await writeCSVObjects(
    f,
    toGenerator(items),
    { header },
  );
}
