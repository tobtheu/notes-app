import type { en } from './locales/en';

export type LanguageOption = 'system' | 'en' | 'de';
export type SupportedLocale = 'en' | 'de';

export type TranslationSchema = typeof en;

export type DotPrefix<T extends string> = T extends '' ? '' : `.${T}`;

export type NestedKeyOf<ObjectType extends object> = {
    [Key in keyof ObjectType & (string | number)]: ObjectType[Key] extends object
        ? `${Key}` | `${Key}.${NestedKeyOf<ObjectType[Key]>}`
        : `${Key}`;
}[keyof ObjectType & (string | number)];

export type TranslationKey = NestedKeyOf<TranslationSchema>;

export interface LanguageInfo {
    code: SupportedLocale;
    label: string;
}
