import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<UserAccount>;

@Schema({
  collection: 'users',
  timestamps: true,
})
export class UserAccount {
  @Prop({ required: true, trim: true })
  displayName: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true })
  passwordSalt: string;

  @Prop({ default: 'admin' })
  role: string;
}

export const UserAccountSchema = SchemaFactory.createForClass(UserAccount);

