import { parse } from "https://deno.land/std@0.203.0/flags/mod.ts";
// @deno-types="npm:@types/highland"
import Highland from "npm:highland@2.13.5";

import { Language, Product } from "./types.ts";
import {
  fetchCategories,
  fetchCumulusPoint,
  fetchExtraInfoForProduct,
  fetchProductsOfCategory,
  fullCategoryOfProduct,
  urlForProduct,
} from "./zurrose.ts";
import { writeCSV } from "./csv.ts";
import { retry } from "./utilities.ts";

const flags = parse(Deno.args, {});
let needHelp = false;

const lang: Language = flags["lang"];
if (lang !== "de" && lang !== "fr") {
  console.error('--lang must be either "de" or "fr"');
  needHelp = true;
}

const output = flags["output"];
if (typeof output !== "string") {
  console.error("--output must be a string");
  needHelp = true;
}

const parallelCategory = typeof flags["parallel-category"] === "number"
  ? flags["parallel-category"]
  : 3;
const parallelProduct = typeof flags["parallel-product"] === "number"
  ? flags["parallel-product"]
  : 5;
const retryCount = typeof flags["retry"] === "number" ? flags["retry"] : 2;

if (needHelp || flags.help || flags.h) {
  console.log(`
--output filename\tPath to the output file
--lang [de|fr]
[--retry = 2]\tHow many times should I retry when scraping fails
[--parallel-category = 3]\tHow many categories should I fetch at the same time
[--parallel-product = 5]\tHow many products should I fetch at the same time
`);
  Deno.exit(0);
}

function main(): Highland.Stream<Product> {
  const stream = Highland(fetchCategories(lang))
    .flatMap((categories) => Highland(categories))
    .map((cat) => fetchProductsOfCategory(lang, cat, 1))
    .parallel(parallelCategory)
    .map((product) =>
      Highland(Promise.all([
        retry(retryCount, () => fetchExtraInfoForProduct(lang, product)).catch(
          (e) => {
            console.error(`fetchExtraInfoForProduct: give up retry`, e);
            return {
              packageSize: "",
              shippingCosts: {
                amount: "",
                currency: "",
              },
            };
          },
        ),
        retry(retryCount, () => fetchCumulusPoint(product)).catch((e) => {
          console.error(`fetchCumulusPoint: give up retry`, e);
          return 0;
        }),
      ]))
        .map(([{ shippingCosts, packageSize }, cumulusPoint]) => ({
          category: product.main_category.category_name,
          fullCategory: fullCategoryOfProduct(product),
          name: product.name,
          packageSize,
          cumulusPoints: String(cumulusPoint),
          price: String(
            product.price.originalPrice || product.price.salesPrice,
          ),
          reducedPrice: String(product.price.salesPrice),
          company: product.best_seller.seller_name,
          shippingCosts: `${shippingCosts.currency} ${shippingCosts.amount}`,
          images: product.files.map((f) => f.url).join("|"),
          link: urlForProduct(lang, product),
        }))
    )
    .parallel(parallelProduct);

  return stream;
}

await writeCSV(output, main());
