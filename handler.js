const { parser } = require("html-metadata-parser");
const { PrismaClient } = require("@prisma/client");
const axios = require("axios").default;

// creating prisma client
const prisma = new PrismaClient();

const getData = async (url) => {
  // check url response status if it is 404 then return null else return data
  try {
    const response = await axios.get(url);
    if (response.status === 404) {
      return null;
    }
    const data = await parser(url);
    return data;
  } catch (error) {
    return null;
  }
};

//delete all data from database
async function deleteSubmittedUrls() {
  const del = await prisma.CommunityUrls.deleteMany({});
  console.log("Items deleted: " + del.count);
}

async function syncToDb() {
  await prisma.$connect();
  const date = new Date();
  let metaArr = [];
  let communityUrls = await prisma.CommunityUrls.findMany();

  for (communityUrls of communityUrls) {
    const data = await getData(communityUrls.url);
    if (data != null) {
      const dataObj = {
        title: data.og.title || data.meta.title,
        url: data.og.url || data.meta.url,
        image: data.og.image || data.meta.image,
        description: data.og.description || data.meta.description,
        pubDate: date.toDateString(),
        author: "Anonymous",
      };
      metaArr = [...metaArr, dataObj];
    }
  }
  //   create new article in database if it is not already in database
  for (let i = 0; i < metaArr.length; i++) {
    const metaObj = metaArr[i];
    const article = await prisma.articles.findUnique({
      where: {
        url: metaObj.url,
      },
    });
    // if article is not in database then create new article
    if (article == null) {
      await prisma.articles.create({
        data: {
          title: metaObj.title,
          url: metaObj.url,
          image: metaObj.image,
          description: metaObj.description,
          pubDate: metaObj.pubDate,
          author: "Community Post",
        },
      });
    }
  }
  console.log("Articles added to database successfully 🚀");
  deleteSubmittedUrls();
  await prisma.$disconnect();
}

syncToDb();
