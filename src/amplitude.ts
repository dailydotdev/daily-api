import * as Amplitude from '@amplitude/node';

const amplitude = Amplitude.init(process.env.AMPLITUDE_KEY);

export default amplitude;
