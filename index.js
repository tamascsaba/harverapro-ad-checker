import search from './lib/search.js';

const iPhoneParameters = {
  keyword: "iPhone 14",
  minPrice: 200000,
  maxPrice: 300000,
  sortBy: "priceAsc",
  selling: true,
  buying: false,
  noiced: false
}
const category = 'aprok/mobil/mobil/apple_keszulekek_tilos_az_icloud_zaras_keszulek/iphone_14/keres.php';

function searchIphone() {
  return search(category, iPhoneParameters);
}

const result = await searchIphone();
console.log(JSON.stringify(result, undefined, 2));


