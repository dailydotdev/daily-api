const input = [{
  url: 'https://www.dailynow.co',
  userId: '123980',
}, {
  url: 'https://www.dailynow.co2',
  userId: '123981',
  approved: true,
}, {
  url: 'https://www.dailynow.co3',
  userId: '123982',
  approved: false,
}, {
  url: 'https://www.dailynow.co4',
  userId: '123983',
  userName: 'Ido',
  userEmail: 'ido@dailynow.co',
}];

const output = input.map(x => Object.assign({}, {
  approved: null,
  reason: null,
  userEmail: null,
  userName: null,
  pubId: null,
  pubImage: null,
  pubName: null,
  pubRss: null,
  pubTwitter: null,
}, x));

export default {
  input,
  output,
};
