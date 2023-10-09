import { DOMParser } from "https://esm.sh/linkedom";
// @deno-types="npm:@types/highland"
import Highland from "npm:highland@2.13.5";

import { Language } from "./types.ts";

export type APICategory = {
  "id": string;
  "level": number;
  "name": string;
  "slug": string;
  "readable_id": string;
  "total_products": number;
  "children"?: APICategory[];
};

export type APIProductSearchResult = {
  searchedProducts: {
    products: APIProduct[];
    pagination: {
      totalPages: number;
      totalProducts: number;
    };
  };
};

export type APIProductBreadcrumb = {
  "id": string; // "f6da8b38-f7cb-4be7-a9b2-7ce8cbaf10f4",
  "name": string; // "Sanität & Mundschutz",
  "readable_id": string; // "QGRPKE"
  "children": APIProductBreadcrumb[];
};

export type APIProductFile = {
  position: number;
  url: string;
};

export type APIProduct = {
  "best_seller": {
    "seller_name": string; // "drogi Drogerie Giger",
  };
  "brand": {
    "readable_id": string;
  };
  "breadcrumb": APIProductBreadcrumb;
  "files": APIProductFile[];
  "landingIds": string[] | null;
  "main_category": {
    "category_code": string; // "cc838215-07a5-4991-8e6a-cc551db4c405",
    "category_id": string; // "cc838215-07a5-4991-8e6a-cc551db4c405",
    "category_name": string; // "Hygienemasken"
  };
  "name": string; // "Mundschutzmaske Typ IIR",
  "price": {
    "currency": string; // "CHF",
    "discount": string; // null,
    "originalPrice": number; // 3.3,
    "salesPrice": number; // 3.9
  };
  "product_id": string; // "7398fe09-6847-440e-a1a1-ec023e16cdf5",
  "quantity_presentation_unit": number; // 50,
  "readable_id": string; // "279H6NGM",
  "slug": string; // "mundschutzmaske-typ-iir",
};

// These infos are not in the API we have to scrap from HTML
export type ExtraProductInfo = {
  packageSize: string;
  shippingCosts: {
    amount: string;
    currency: string;
  };
};

function isoLang(lang: Language): string {
  if (lang === "de") {
    return "de-DE";
  }
  return "fr-FR";
}

export async function fetchCategories(lang: Language): Promise<APICategory[]> {
  const res = await fetch(
    "https://api-mkp.zurrose-shop.ch/category-tree?orderBy=created_at&orderType=ASC",
    {
      headers: {
        "Accept": "application/json",
        "Accept-Language": isoLang(lang),
      },
    },
  );
  const json = await res.json();
  return json;
}

export function fetchProductsOfCategory(
  lang: Language,
  category: APICategory,
  sincePage: number, /* from 1 */
): Highland.Stream<APIProduct> {
  const url =
    `https://api-mkp.zurrose-shop.ch/search?categoryIds[]=${category.id}&page=${sincePage}&size=300&facets=0&onlyFacets=0&facetsCategoryLevel=${category.level}&pageName=category_page&fullSearch=true`;
  console.log("fetching category:", url);
  return Highland(
    fetch(url, {
      headers: {
        "Accept": "application/json",
        "Accept-Language": isoLang(lang),
      },
    }),
  )
    .flatMap((res) => Highland(res.json()) as unknown as APIProductSearchResult)
    .flatMap((json) => {
      // console.log("fetchProductsOfCategory", json);
      const products = json.searchedProducts.products;
      const rest = products.length
        ? fetchProductsOfCategory(lang, category, sincePage + 1)
        : Highland<APIProduct>([]);
      return Highland(products).concat(rest);
    });
}

export function urlForProduct(lang: Language, product: APIProduct): string {
  return `https://www.zurrose-shop.ch/${lang}/${
    encodeURIComponent(product.slug)
  }/dp/${product.readable_id}`;
}

const domParser = new DOMParser();
export async function fetchExtraInfoForProduct(
  lang: Language,
  product: APIProduct,
): Promise<ExtraProductInfo> {
  try {
    const url = urlForProduct(lang, product);
    console.log("Processing product: ", url);
    const res = await fetch(url);
    const html = await res.text();
    const document = domParser.parseFromString(html, "text/html");
    const serverAppState = JSON.parse(
      document.querySelector("script[defer]").innerHTML.replace(
        "window.__SERVER_APP_STATE__ =  ",
        "",
      ),
    );
    if (!serverAppState?.initialData?.product?.best_seller?.shippingCosts) {
      // console.error('shippingCosts not found', product);
    }
    return {
      packageSize:
        document.querySelector(".product-detail__seller_quantity")?.innerText
          ?.trim() ?? "",
      shippingCosts:
        serverAppState?.initialData?.product?.best_seller?.shippingCosts ?? {
          amount: "",
          currency: "",
        },
    };
  } catch (e) {
    throw new Error(`fetchExtraInfoForProduct error: ${e} ${product}`);
  }
}

export async function fetchCumulusPoint(product: APIProduct): Promise<number> {
  const body = JSON.stringify({
    "cumulusCode": "",
    "input": {
      "products": {
        "brandReadableId": product.brand.readable_id,
        "breadcrumb": patchBreadcrumbForCumulusPoint(product.breadcrumb),
        "id": product.product_id,
        "landingIds": product.landingIds || [],
        "numberOfUnits": 1,
        "price": product.price.salesPrice,
        "productReadableId": product.readable_id,
      },
    },
  });
  let res;
  let resJSON;
  try {
    res = await fetch(
      "https://api-mkp.zurrose-shop.ch/cumulus/calculatePoints",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body,
      },
    );
    resJSON = await res.text();
    return JSON.parse(resJSON).totalPoints;
  } catch (e) {
    throw new Error(`fetchCumulusPoint Error: ${e}.
Body: ${body}.
res: ${res}.
resJSON: ${resJSON}.
product: ${product}.`);
  }
}

function patchBreadcrumbForCumulusPoint(breadcrumb: any) {
  // Seems like we have to make sure each breadcrumb contains a slug,
  // otherwise it sometimes return {"message":"An error occurred"}
  return {
    ...breadcrumb,
    children: breadcrumb.children.map(patchBreadcrumbForCumulusPoint),
    slug: breadcrumb.readable_id,
  };
}
