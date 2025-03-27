import * as StdFlags from "https://deno.land/std@0.203.0/flags/mod.ts";
import * as XML from "https://deno.land/x/xml/mod.ts";
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts";
// @deno-types="npm:@types/highland"
import Highland from "npm:highland@2.13.5";

import { toGenerator } from "./utilities.ts";
import { writeCSV } from "./csv.ts";

async function fetchUrls(): Promise<string[]> {
  const url = "https://www.amavita.ch/sitemaps/de/sitemap-1-4.xml";
  const res = await fetch(url);
  const xml = XML.parse(await res.text());
  const urls: any[] = (xml?.urlset as any).url;
  return urls.map((a) => a.loc) ?? [];
}

type Page = {
  name: string;
  subname: string;
  articleNumber: string;
  price: string;
  images: string;
  url: string;
};

const domParser = new DOMParser();
async function processPage(url: string): Promise<Page> {
  const res = await fetch(url);
  const html = await res.text();
  const document = domParser.parseFromString(html, "text/html");
  const magentoScripts = document.querySelectorAll(
    'script[type="text/x-magento-init"]',
  );
  const images = [];
  for (const magentoScript of magentoScripts) {
    try {
      const obj = JSON.parse(magentoScript.innerText);
      const url =
        obj["[data-gallery-role=gallery-placeholder]"]["mage/gallery/gallery"]
          .data.map((d: any) => d.full);
      images.push(url);
    } catch (e) {
      // ignore
    }
  }

  const name = document.querySelector(".product-title__main")?.innerText
    ?.trim();
  const subname = document.querySelector(".product-title__subtitle")?.innerText
    ?.trim();

  return {
    name: (name || subname) ?? "",
    subname: subname ?? "",
    articleNumber:
      document.querySelector(".product-info-article-number")?.innerText
        ?.replaceAll("Art.Nr.", "")?.trim() ?? "",
    price: document.querySelector(".price")?.innerText ?? "",
    images: images.join("|"),
    url,
  };
}

export type Flags = {
  output: string;
  "parallel-product": number;
};

export async function main(flags: Partial<Flags>) {
  const output = flags["output"];
  if (typeof output !== "string") {
    console.error("--output must be a string");
    return;
  }
  const urls = await fetchUrls();
  let count = 0;
  const stream = Highland(urls)
    .map((url) => Highland(processPage(url)))
    .parallel(flags["parallel-product"] || 5)
    .doto((x) => console.log(`${++count}/${urls.length}`, x.url));
  const header = ["name", "subname", "articleNumber", "price", "images"];
  await writeCSV(output, header, stream);
}

if (import.meta.main) {
  await main(StdFlags.parse(Deno.args));
}
