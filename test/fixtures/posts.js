import publications from './publications';
import config from '../../src/config';

const input = [
  {
    id: '1',
    title: 'Post #1',
    url: 'https://myblog.com/post.html',
    publicationId: publications[0].id,
    publishedAt: new Date(2017, 10, 21, 15, 10, 5),
    createdAt: new Date(2017, 10, 21, 15, 10, 5),
    image: 'https://myblog.com/image.png',
    ratio: 1.2,
    placeholder: 'data:image/png;base64,qweuoi2108js',
  },
  {
    id: '2',
    title: 'Post #2',
    url: 'https://myblog.com/post2.html',
    publicationId: publications[1].id,
    createdAt: new Date(2017, 10, 21, 15, 10, 10),
  },
  {
    id: '3',
    title: 'Post #3',
    url: 'https://myblog.com/post3.html',
    publicationId: publications[2].id,
    createdAt: new Date(2017, 10, 21, 15, 10, 10),
  },
];

const output = [
  {
    id: input[1].id,
    title: input[1].title,
    url: input[1].url,
    publishedAt: null,
    createdAt: input[1].createdAt,
    image: config.defaultImage.url,
    ratio: config.defaultImage.ratio,
    placeholder: config.defaultImage.placeholder,
    publication: {
      id: publications[1].id,
      name: publications[1].name,
      image: publications[1].image,
    },
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
  },
];

export default { input, output };
