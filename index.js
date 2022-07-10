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
    "https://hackernoon.com/feed",
    "https://techcrunch.com/feed/",
    "http://theverge.com/rss/index.xml",
    "https://dev.to/feed",
    "https://thenextweb.com/feed",
    "https://www.wired.com/feed",
    "https://hackernoon.com/feed",
    "https://css-tricks.com/feed/",
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

async function main() {
  // creating connection
  await prisma.$connect();
  // creating data into soruce collection
  await prisma.articles.create({
    data: {
      title: dataObj.title,
      url: dataObj.url,
      image: dataObj.image,
      description: dataObj.description,
      pubDate: feed.pubDate,
      author: feed.author,
    },
  });
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
  await prisma.$connect();
  const feedUrls = await syncFeed();
  try {
    const metaData = feedUrls?.map(async (feed) => {
      const data = await getData(feed.url);
      dataObj = {
        title: data.og.title || data.meta.title,
        url: data.og.url || data.meta.url,
        image: data.og.image || data.meta.image,
        description: data.og.description || data.meta.description,
        pubDate: feed.pubDate,
        author: feed.author,
      };
      console.log(dataObj);
      await prisma.articles.create({
        data: {
          title: dataObj.title,
          url: dataObj.url,
          image: dataObj.image,
          description: dataObj.description,
          pubDate: feed.pubDate,
          author: feed.author,
        },
      });
    });
  } catch (err) {
    console.log(err);
  }
}

feedFetching();
