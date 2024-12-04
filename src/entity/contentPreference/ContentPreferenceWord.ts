import { ChildEntity } from 'typeorm';
import { ContentPreference } from './ContentPreference';
import { ContentPreferenceType } from './types';

@ChildEntity(ContentPreferenceType.Word)
export class ContentPreferenceWord extends ContentPreference {}
