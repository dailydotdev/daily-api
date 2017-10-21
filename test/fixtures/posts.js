import publications from './publications';

const input = [
  {
    id: '1',
    title: 'Post #1',
    url: 'https://myblog.com/post.html',
    publicationId: publications[0].id,
    publishedAt: new Date(2017, 10, 21, 15, 10, 5),
    image: 'https://myblog.com/image.png',
  },
  {
    id: '2',
    title: 'Post #2',
    url: 'https://myblog.com/post2.html',
    publicationId: publications[1].id,
    publishedAt: new Date(2017, 10, 21, 15, 10, 10),
  },
];

const output = [
  {
    id: input[1].id,
    title: input[1].title,
    url: input[1].url,
    publishedAt: input[1].publishedAt,
    image: publications[1].image,
    publication: {
      id: publications[1].id,
      name: publications[1].name,
    },
  },
  {
    id: input[0].id,
    title: input[0].title,
    url: input[0].url,
    publishedAt: input[0].publishedAt,
    image: input[0].image,
    publication: {
      id: publications[0].id,
      name: publications[0].name,
    },
  },
];

export default { input, output };
