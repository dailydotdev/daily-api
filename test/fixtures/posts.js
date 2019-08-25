import publications from './publications';
import config from '../../src/config';

const now = new Date();
now.setMilliseconds(0);

const input = [
  {
    id: '1',
    title: 'Post #1',
    url: 'https://myblog.com/post.html',
    publicationId: publications[0].id,
    publishedAt: new Date(now - 1000),
    createdAt: new Date(now - 2000),
    image: 'https://myblog.com/image.png',
    ratio: 1.2,
    placeholder: 'data:image/png;base64,qweuoi2108js',
    promoted: false,
    tags: ['a', 'b'],
    views: 1,
    readTime: 5,
  },
  {
    id: '2',
    title: 'Style your Terminal better by mastering these settings 🤩\\xF0\\x9F\\xA4\\xA9',
    url: 'https://myblog.com/post2.html',
    publicationId: publications[1].id,
    createdAt: now,
    promoted: false,
    views: 2,
    tags: ['a'],
  },
  {
    id: '3',
    title: 'Post #3',
    url: 'https://myblog.com/post3.html',
    publicationId: publications[2].id,
    createdAt: new Date(now - 1000),
    promoted: false,
    views: 3,
  },
  {
    id: '4',
    title: 'Post #4',
    url: 'https://myblog.com/post4.html',
    publicationId: publications[2].id,
    createdAt: now,
    promoted: true,
    views: 4,
  },
];

const output = [
  {
    id: input[1].id,
    title: input[1].title,
    url: input[1].url,
    publishedAt: null,
    createdAt: input[1].createdAt,
    image: config.defaultImage.url[0],
    ratio: config.defaultImage.ratio,
    placeholder: config.defaultImage.placeholder,
    publication: {
      id: publications[1].id,
      name: publications[1].name,
      image: publications[1].image,
    },
    views: input[1].views,
    tags: input[1].tags,
    readTime: null,
  },
  {
    id: input[0].id,
    title: input[0].title,
    url: input[0].url,
    publishedAt: input[0].publishedAt,
    createdAt: input[0].createdAt,
    image: input[0].image,
    ratio: 1.2,
    placeholder: 'data:image/png;base64,qweuoi2108js',
    publication: {
      id: publications[0].id,
      name: publications[0].name,
      image: publications[0].image,
    },
    views: input[0].views,
    tags: input[0].tags,
    readTime: input[0].readTime,
  },
];

const pubsOutput = [
  {
    id: input[1].id,
    title: input[1].title,
    url: input[1].url,
    publishedAt: null,
    createdAt: input[1].createdAt,
    image: config.defaultImage.url[0],
    ratio: config.defaultImage.ratio,
    placeholder: config.defaultImage.placeholder,
    publication: {
      id: publications[1].id,
      name: publications[1].name,
      image: publications[1].image,
    },
    views: input[1].views,
    tags: input[1].tags,
    readTime: null,
  },
];

const tagsOutput = output;

const bookmarks = [
  { userId: 'user1', postId: input[1].id },
  { userId: 'user1', postId: input[0].id },
  { userId: 'user2', postId: input[0].id },
];

export default {
  input,
  output,
  pubsOutput,
  tagsOutput,
  bookmarks,
};
