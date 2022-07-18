const { parser } = require("html-metadata-parser");
const Parser = require("rss-parser");
const { PrismaClient } = require("@prisma/client");

// creating prisma client
const prisma = new PrismaClient();

async function getData(url) {
  const result = await parser(url);
  return result;
}

function timeDifference(date1, date2) {
  const difference = Math.floor(date1) - Math.floor(date2);

  const diffInDays = Math.floor(difference / 60 / 60 / 24);
  const diffInHours = Math.floor(difference / 60 / 60);
  const diffInMinutes = Math.floor(difference / 60);
  const diffInSeconds = Math.floor(difference);

  return {
    date1,
    date2,
    diffInDays,
    diffInHours,
    diffInMinutes,
    diffInSeconds,
  };
}
async function getNewFeedItemsFrom(feedUrl) {
  const parser = new Parser();
  let rss;
  try {
    rss = await parser.parseURL(feedUrl);
  } catch (error) {
    console.error(error);
    return [];
  }
  const todaysDate = new Date().getTime() / 1000;
  return rss.items.filter((item) => {
    const blogPublishedDate = new Date(item.pubDate).getTime() / 1000;
    const { diffInDays } = timeDifference(todaysDate, blogPublishedDate);
    return diffInDays === 0;
  });
}

async function getNewFeedItems() {
  let allNewFeedItems = [];

  const feeds = [
    "https://www.cnet.com/rss/news/",
    "https://blog.codinghorror.com/rss/",
    "https://css-tricks.com/feed/",
    "https://cult.honeypot.io/rss.xml",
    "https://dev.to/feed",
    "https://www.freecodecamp.org/news/rss",
    "https://hackernoon.com/feed",
    "https://javascript.plainenglish.io/feed",
    "https://mashable.com/feeds/rss/tech",
    "https://www.technologyreview.com/feed/",
    "https://www.omgubuntu.co.uk/feed",
    "https://blog.openreplay.com/rss.xml",
    "https://www.producthunt.com/feed",
    "https://www.smashingmagazine.com/feed/",
    "https://techcrunch.com/feed/",
    "https://feeds.feedburner.com/TheHackersNews",
    "https://thenextweb.com/feed/",
    "https://www.theverge.com/rss/index.xml",
    "https://www.vox.com/rss/technology/index.xml",
    "https://www.wired.com/feed/",
    "https://www.xda-developers.com/feed/",
  ];

  for (let i = 0; i < feeds.length; i++) {
    const feedUrl = feeds[i];
    const feedItems = await getNewFeedItemsFrom(feedUrl);
    allNewFeedItems = [...allNewFeedItems, ...feedItems];
  }

  // sort feed items by published date
  allNewFeedItems.sort((a, b) => new Date(a.pubDate) - new Date(b.pubDate));
  return allNewFeedItems;
}

async function syncFeed() {
  const data = await getNewFeedItems();

  const feedUrls = data.map((item) => {
    const dataObj = {
      // title: item.title,
      url: item.link,
      // description: item.contentSnippet,
      pubDate: item.pubDate,
      // check if author is available if not then it will be creator
      author: item.creator || item.author,
    };
    return dataObj;
  });
  return feedUrls;
}

async function feedFetching() {
  let metaArr = [];
  const feedUrls = await syncFeed();

  for (let i = 0; i < feedUrls.length; i++) {
    const feedUrl = feedUrls[i];
    const data = await getData(feedUrl.url);
    // console.log(feedItems)
    let metaObj = {
      title: data.og.title || data.meta.title,
      url: data.og.url || data.meta.url,
      image: data.og.image || data.meta.image,
      description: data.og.description || data.meta.description,
      pubDate: feedUrl.pubDate,
      author: feedUrl.author || "Anonymous",
    };
    metaArr = [...metaArr, metaObj];
  }
  // console.log(metaArr);
  return metaArr;
}

async function syncToDb() {
  await prisma.$connect();
  const res = await feedFetching();
  const mongoUrls = await prisma.articles.findMany();
  // console.log(mongoUrls);

  // comapring urls from res.urls and mongoUrls
  const urlsToBeAdded = res.filter((item) => {
    return !mongoUrls.find((mongoItem) => {
      return mongoItem.url === item.url;
    });
  });
  console.log(urlsToBeAdded);
  // adding data to database
  for (let i = 0; i < urlsToBeAdded.length; i++) {
    const url = urlsToBeAdded[i];
    await prisma.articles.create({
      data: {
        title: url.title,
        url: url.url,
        image:
          url.image ||
          "https://res.cloudinary.com/amrohan/image/upload/v1658154724/Images/jhlb4lmgalptjtk2hknv.jpg",
        description: url.description || "",
        pubDate: url.pubDate,
        author: url.author,
      },
    });
  }
}

// delete all data from database
// async function del() {
//   const del = await prisma.articles.deleteMany({});
// }
// del();

syncToDb();
