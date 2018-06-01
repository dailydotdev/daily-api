const input = [
  {
    id: '1',
    title: 'Ad #1',
    url: 'https://ads.com/1.html',
    source: 'BestAds',
    start: new Date(2017, 10, 21, 15, 10, 5),
    end: new Date(2017, 10, 25, 15, 10, 5),
    image: 'https://myblog.com/image.png',
    ratio: 1.2,
    placeholder: 'data:image/png;base64,qweuoi2108js',
  },
  {
    id: '2',
    title: 'Ad #2',
    url: 'https://ads.com/2.html',
    source: 'GreatAds',
    start: new Date(2017, 11, 21, 15, 10, 5),
    end: new Date(2017, 11, 25, 15, 10, 5),
    image: 'https://myblog.com/image.png',
    ratio: 1.2,
    placeholder: 'data:image/png;base64,qweuoi2108js',
  },
  {
    id: '3',
    title: 'Ad #3',
    url: 'https://ads.com/1.html',
    source: 'AmazingAds',
    start: new Date(2017, 10, 22, 15, 10, 5),
    end: new Date(2017, 10, 26, 15, 10, 5),
    image: 'https://myblog.com/image.png',
    ratio: 1.2,
    placeholder: 'data:image/png;base64,qweuoi2108js',
  },
];

const output = [
  {
    id: input[0].id,
    title: input[0].title,
    url: input[0].url,
    source: input[0].source,
    image: input[0].image,
    ratio: input[0].ratio,
    placeholder: input[0].placeholder,
  },
  {
    id: input[2].id,
    title: input[2].title,
    url: input[2].url,
    source: input[2].source,
    image: input[2].image,
    ratio: input[2].ratio,
    placeholder: input[2].placeholder,
  },
];

export default { input, output };
