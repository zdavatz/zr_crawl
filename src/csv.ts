import { writeCSVObjects } from "https://deno.land/x/csv@v0.9.2/mod.ts";
import { encodeHex } from "https://deno.land/std@0.202.0/encoding/hex.ts";
// @deno-types="npm:@types/highland"
import Highland from "npm:highland@2.13.5";

import { CsvRow, Product } from "./types.ts";

const header = [
  "hash",
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

async function* toGenerator<T>(
  stream: Highland.Stream<T>,
): AsyncGenerator<Product, void, void> {
  let ended = false;
  while (!ended) {
    const value: Product | Highland.Nil = await new Promise((res, rej) => {
      stream.pull((err, x) => {
        if (err) {
          rej(err);
        } else {
          res(x);
        }
      });
    });

    if (Highland.isNil(value)) {
      return;
    } else {
      yield value;
    }
  }
}

async function hashProduct(product: Product): string {
  let message = "";
  message += product.category;
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

async function addHash(product: Product): CsvRow {
  return {
    ...product,
    hash: await hashProduct(product),
  };
}

export async function writeCSV(
  outputFile: string,
  products: Highland.Stream<Product>,
): Promise<void> {
  const f = await Deno.open(outputFile, {
    write: true,
    create: true,
    truncate: true,
  });
  await writeCSVObjects(
    f,
    toGenerator(products.flatMap((p) => Highland(addHash(p)))),
    { header },
  );
}
