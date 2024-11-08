import { ChildEntity } from 'typeorm';
import { ContentPreferenceType } from './types';
import { ContentPreferenceSource } from './ContentPreferenceSource';

@ChildEntity(ContentPreferenceType.FeedSource)
export class ContentPreferenceFeedSource extends ContentPreferenceSource {}
