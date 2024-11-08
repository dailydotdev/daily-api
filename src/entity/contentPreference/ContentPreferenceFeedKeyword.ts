import { ChildEntity } from 'typeorm';
import { ContentPreferenceType } from './types';
import { ContentPreferenceKeyword } from './ContentPreferenceKeyword';

@ChildEntity(ContentPreferenceType.FeedKeyword)
export class ContentPreferenceFeedKeyword extends ContentPreferenceKeyword {}
