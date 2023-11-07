export type Language = "de" | "fr";

export type Product = {
  category: string; // Category name. Take the category name from the category landing page. The category name is also in the link.
  fullCategory: string; // Full category, including the parent categories's name
  name: string; // Prodcut name
  packageSize: string; // Package size (below the name)
  cumulusPoints: string; // Cumulus points
  price: string; // Price
  reducedPrice: string; // Reduced Price
  company: string; // Company name (behind "verkauft von:")
  shippingCosts: string; // Shipping costs (behind "Versandkosten:")
  images: string; // Links to the images.
  link: string; // Full link to the product in the shop
  brand: string; // Brand name, https://github.com/zdavatz/zr_crawl/issues/5
};

export type CsvRow = Product & {
  // Unique Hash per line calculated by the value of the fields. If the value of the fields do not change, the Hash should not change.
  hash: string;
};
