import request from "./request.js";
import * as cheerio from 'cheerio';

export default async (category, query) => {
  const qs = {
    stext: query.keyword || "",
    county: query.county || "",
    settlement: query.settlement || "",
    minprice: query.minPrice || "",
    maxprice: query.maxPrice || "",
    company: query.brand || "",
    user: query.seller || "",
    selling: query.selling === false ? 0 : 1,
    buying: query.buying === false ? 0 : 1,
    stext_none: query.excludedWords || "",
    sortBy: parseSortParam(query.sortBy),
    noiced: query.noiced === false ? 0 : 1
  };

  const response = await request.get(category, null, qs);
  const lastOffset = getLastOffset(response.body);

  if (lastOffset != 0) {
    return await bulkFetchAds(category, qs, lastOffset);
  }

  return extractAds(response.body);
};

const parseSortParam = (sortParam) => {
  switch (sortParam) {
    case "newest":
      return "time.d.200.normal";
    case "lastUp":
      return "lstup.d.200.normal";
    case "priceAsc":
      return "price.a.200.normal";
    case "priceDesc":
      return "price.d.200.normal";
    default:
      return "time.d.200.normal";
  }
};

const bulkFetchAds = async (endpoint, qs, lastOffset) => {
  let requests = [];
  for (let i = 0; i <= lastOffset; i += 200) {
    qs.offset = i;
    requests.push(fetchAds(endpoint, qs));
  }

  return Promise.all(requests)
    .then((ads) => {
      ads = ads.flat();
      return ads;
    })
    .catch((err) => console.error(err));
};

const fetchAds = async (endpoint, qs) => {
  const response = await request.get(endpoint, null, qs);
  return extractAds(response.body);
};

const getLastOffset = (html) => {
  const $ = cheerio.load(html, { decodeEntities: true });
  const lastPageButton = $("span.fa-fast-forward");

  if (!isLastPage(html)) {
    const lastOffsetElement = lastPageButton.parent("a");
    const lastOffsetString = lastOffsetElement.attr("href").split("offset=")[1];
    const lastOffset = parseInt(lastOffsetString);
    return lastOffset;
  }
  return 0;
};

const isLastPage = (html) => {
  const $ = cheerio.load(html, { decodeEntities: true });
  const lastPageButton = $("span.fa-forward");

  return lastPageButton.parent("a").hasClass("disabled");
};

const extractAds = (html) => {
  const $ = cheerio.load(html, { decodeEntities: false });

  const adElements = $("li.media").not("li.media[onClick]");

  const ads = adElements
    .map((i, elem) => {
      const ad = extractAdInfoFromSearch(elem);
      const isFrozen = hasFrozenStatus(elem);
      const featuredImage = extractFeaturedImageFromSearch(elem);
      const imageCount = extractImageCountFromSearch(elem);
      const price = extractPriceFromSearch(elem);
      const locations = extractLocationsFromSearch(elem);
      const seller = extractSellerInfoFromSearch(elem);

      return {
        ad: ad,
        isFrozen: isFrozen,
        price: price,
        locations: locations,
        image: {
          featured: featuredImage,
          count: imageCount,
        },
        seller: seller,
      };
    })
    .get();

  return ads;
};

const extractAdInfoFromSearch = (html) => {
  const $ = cheerio.load(html, { decodeEntities: true });

  const adInfoElement = $(html).find("h1 > a");
  const adTitle = adInfoElement.text().trim();
  const addUrl = adInfoElement.attr("href");
  const adSlug = addUrl.split("/")[4];

  return { title: adTitle, url: addUrl, slug: adSlug };
};

const hasFrozenStatus = (html) => {
  const $ = cheerio.load(html, { decodeEntities: true });

  return $(html).find("p[style]").length !== 0;
};

const extractFeaturedImageFromSearch = (html) => {
  const $ = cheerio.load(html, { decodeEntities: true });

  if (hasFeaturedImage(html)) {
    const rawImgPath = $(html).find("a.uad-image img").attr("src");
    return `https:${rawImgPath.slice(0, -4)}`; //full size image url without sizing
  }

  return "";
};

const hasFeaturedImage = (html) => {
  const $ = cheerio.load(html, { decodeEntities: true });

  const rawImgPath = $(html).find("a.uad-image img").attr("src");
  return !rawImgPath.includes("noimage");
};

const extractImageCountFromSearch = (html) => {
  if (hasFeaturedImage(html)) {
    const $ = cheerio.load(html, { decodeEntities: true });

    const imageCountElement = $(html).find("a.uad-image > span.uad-photos");
    const imageCount = parseInt(imageCountElement.text().trim());

    return imageCount;
  }

  return 0;
};

const extractPriceFromSearch = (html) => {
  const $ = cheerio.load(html, { decodeEntities: true });

  const priceString = $(".uad-price").text().trim();
  const priceInt = parseInt(priceString.slice(0, -2).replace(/ /g, ""));
  const price = Number.isInteger(priceInt) ? priceInt : priceString;

  return price;
};

const extractLocationsFromSearch = (html) => {
  const $ = cheerio.load(html, { decodeEntities: true });

  const infoContainer = $(html).find(".uad-info");
  const locationsElement = $(infoContainer).find(".uad-light");
  const locations =
    locationsElement.children("span").length != 0
      ? locationsElement
        .children("span")
        .attr("title")
        .split(",")
        .map((location) => location.trim())
      : [locationsElement.text().trim()];

  return locations;
};

const extractSellerInfoFromSearch = (html) => {
  const $ = cheerio.load(html, { decodeEntities: true });

  const miscContainer = $(html).find(".uad-misc");
  const username = $(miscContainer).find(".uad-light > a").text();
  const userSlug = $(miscContainer).find(".uad-light > a").attr("href").split("/")[2].split(".")[0];

  const { positiveRatings, negativeRatings } = extractReputationFromSearch(html);

  return { username: username, slug: userSlug, reputation: { positive: positiveRatings, negative: negativeRatings } };
};

const extractReputationFromSearch = (html) => {
  const $ = cheerio.load(html, { decodeEntities: true });

  const reputationElemenet = $(html).find(".uad-light > span.text-nowrap > span.uad-rating");
  const reputationString = reputationElemenet.attr("title");

  const positiveRatings = isNaN(parseInt(reputationString.split(",")[0])) ? 0 : parseInt(reputationString.split(",")[0]);
  const negativeRatings = isNaN(parseInt(reputationString.split(",")[1])) ? 0 : parseInt(reputationString.split(",")[1]);

  return { positiveRatings, negativeRatings };
};