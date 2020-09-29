export const defaultImage = {
  urls: process.env.DEFAULT_IMAGE_URL.split(','),
  ratio: parseFloat(process.env.DEFAULT_IMAGE_RATIO),
  placeholder: process.env.DEFAULT_IMAGE_PLACEHOLDER,
};

export const pickImageUrl = (post: { createdAt: Date }): string =>
  defaultImage.urls[
    Math.floor(post.createdAt.getTime() / 1000) % defaultImage.urls.length
  ];
