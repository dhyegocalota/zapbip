import { COMPANY, OwnerLocale } from '@zapbip/types';

export type InstallPageTexts = {
  ownerLanguage: string;
  unsupportedProduct: string;
  expired: string;
  notFound: string;
  footer: string;
};

export const INSTALL_PAGE_COPY: Record<OwnerLocale, InstallPageTexts> = {
  [OwnerLocale.PortugueseBrazil]: {
    ownerLanguage: 'Brazilian Portuguese',
    unsupportedProduct: 'O zapbip ainda não conhece este produto. Não consegui instalar.',
    expired: 'Este link expirou ou já foi usado. Peça um novo ao zapbip no WhatsApp: envie `girar <nome>`.',
    notFound: 'Não encontrado.',
    footer: `zapbip é um produto da ${COMPANY.tradeName}`,
  },
  [OwnerLocale.EnglishUs]: {
    ownerLanguage: 'US English',
    unsupportedProduct: 'zapbip does not know this product yet. I could not install it.',
    expired: 'This link has expired or was already used. Ask zapbip on WhatsApp for a new one: send `rotate <name>`.',
    notFound: 'Not found.',
    footer: `zapbip is a product of ${COMPANY.tradeName}`,
  },
  [OwnerLocale.Spanish]: {
    ownerLanguage: 'Spanish',
    unsupportedProduct: 'zapbip todavía no conoce este producto. No pude instalarlo.',
    expired: 'Este enlace caducó o ya se usó. Pide uno nuevo a zapbip por WhatsApp: envía `rotar <nombre>`.',
    notFound: 'No encontrado.',
    footer: `zapbip es un producto de ${COMPANY.tradeName}`,
  },
  [OwnerLocale.German]: {
    ownerLanguage: 'German',
    unsupportedProduct: 'zapbip kennt dieses Produkt noch nicht. Ich konnte es nicht installieren.',
    expired: 'Dieser Link ist abgelaufen oder wurde schon benutzt. Bitte zapbip in WhatsApp um einen neuen: Sende `erneuern <name>`.',
    notFound: 'Nicht gefunden.',
    footer: `zapbip ist ein Produkt von ${COMPANY.tradeName}`,
  },
  [OwnerLocale.French]: {
    ownerLanguage: 'French',
    unsupportedProduct: 'zapbip ne connaît pas encore ce produit. Je n’ai pas pu l’installer.',
    expired: 'Ce lien a expiré ou a déjà servi. Demandez-en un nouveau à zapbip sur WhatsApp\u00a0: envoyez `renouveler <nom>`.',
    notFound: 'Introuvable.',
    footer: `zapbip est un produit de ${COMPANY.tradeName}`,
  },
  [OwnerLocale.Japanese]: {
    ownerLanguage: 'Japanese',
    unsupportedProduct: 'zapbipはこの製品をまだ認識していません。インストールできませんでした。',
    expired: 'このリンクは期限切れか、使用済みです。WhatsAppでzapbipに新しいリンクを依頼してください: `再発行 <名前>`と送信します。',
    notFound: '見つかりません。',
    footer: `zapbipは${COMPANY.tradeName}の製品です`,
  },
  [OwnerLocale.Korean]: {
    ownerLanguage: 'Korean',
    unsupportedProduct: 'zapbip은 아직 이 제품을 알지 못합니다. 설치하지 못했습니다.',
    expired: '이 링크는 만료되었거나 이미 사용되었습니다. WhatsApp에서 zapbip에 새 링크를 요청하세요: `재발급 <이름>`을 보내세요.',
    notFound: '찾을 수 없습니다.',
    footer: `zapbip은 ${COMPANY.tradeName}의 제품입니다`,
  },
  [OwnerLocale.ChineseSimplified]: {
    ownerLanguage: 'Simplified Chinese',
    unsupportedProduct: 'zapbip 还不认识这个产品。我无法安装它。',
    expired: '此链接已过期或已被使用。请在 WhatsApp 上向 zapbip 要一个新的：发送 `轮换 <名称>`。',
    notFound: '未找到。',
    footer: `zapbip 是 ${COMPANY.tradeName} 的产品`,
  },
  [OwnerLocale.Arabic]: {
    ownerLanguage: 'Modern Standard Arabic',
    unsupportedProduct: 'zapbip لا يعرف هذا المنتج بعد. تعذّر عليّ تثبيته.',
    expired: 'انتهت صلاحية هذا الرابط أو سبق استخدامه. اطلب رابطًا جديدًا من zapbip على واتساب: أرسل `تجديد <الاسم>`.',
    notFound: 'غير موجود.',
    footer: `zapbip منتج من ${COMPANY.tradeName}`,
  },
};
